import { mkdirSync, writeFileSync } from "fs";
import { inflateRawSync } from "zlib";
import { assert } from "chai";
import {
  ZipArchiveEntry,
  ZipArchiveOutputStream,
} from "../lib/compress-commons.js";

// Independent record offsets from PKWARE APPNOTE 6.3.10, sections
// 4.3.12, 4.3.14-16 and 4.5.3:
// https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
function directory(buffer, count, zip64) {
  var end = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(end), 0x06054b50);
  assert.equal(buffer.readUInt16LE(end + 20), 0);
  var size = buffer.readUInt32LE(end + 12);
  var offset = buffer.readUInt32LE(end + 16);
  if (zip64) {
    var locator = end - 20;
    assert.equal(buffer.readUInt32LE(locator), 0x07064b50);
    assert.equal(buffer.readUInt32LE(locator + 4), 0);
    assert.equal(buffer.readUInt32LE(locator + 16), 1);
    var record = Number(buffer.readBigUInt64LE(locator + 8));
    assert.equal(buffer.readUInt32LE(record), 0x06064b50);
    assert.equal(buffer.readBigUInt64LE(record + 4), 44n);
    assert.equal(buffer.readUInt16LE(record + 14), 45);
    assert.equal(buffer.readUInt32LE(record + 16), 0);
    assert.equal(buffer.readUInt32LE(record + 20), 0);
    assert.equal(buffer.readBigUInt64LE(record + 24), BigInt(count));
    assert.equal(buffer.readBigUInt64LE(record + 32), BigInt(count));
    assert.equal(buffer.readUInt16LE(end + 8), 0xffff);
    assert.equal(buffer.readUInt16LE(end + 10), 0xffff);
    assert.equal(size, 0xffffffff);
    assert.equal(offset, 0xffffffff);
    size = Number(buffer.readBigUInt64LE(record + 40));
    offset = Number(buffer.readBigUInt64LE(record + 48));
    assert.equal(offset + size, record);
    assert.equal(record + 56, locator);
  } else {
    assert.equal(buffer.readUInt16LE(end + 8), count);
    assert.equal(buffer.readUInt16LE(end + 10), count);
    assert.equal(offset + size, end);
  }
  var cursor = offset;
  var entries = [];
  while (cursor < offset + size) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    var nameLength = buffer.readUInt16LE(cursor + 28);
    var extraLength = buffer.readUInt16LE(cursor + 30);
    var commentLength = buffer.readUInt16LE(cursor + 32);
    var local = buffer.readUInt32LE(cursor + 42);
    assert.equal(buffer.readUInt32LE(local), 0x04034b50);
    entries.push({
      name: buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength),
      method: buffer.readUInt16LE(cursor + 10),
      size: buffer.readUInt32LE(cursor + 24),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      local: local,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, offset + size);
  assert.lengthOf(entries, count);
  return entries;
}

async function archiveBuffer(options, count, method, payload) {
  var archive = new ZipArchiveOutputStream(options);
  var chunks = [];
  var complete = new Promise(function (resolve, reject) {
    archive.on("data", function (chunk) {
      chunks.push(chunk);
    });
    archive.once("error", reject);
    archive.once("end", function () {
      resolve(Buffer.concat(chunks));
    });
  });
  for (var i = 0; i < count; i++) {
    var entry = new ZipArchiveEntry("entry-" + i + ".txt");
    entry.setMethod(method);
    await new Promise(function (resolve, reject) {
      archive.entry(entry, payload, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  archive.finish();
  return complete;
}

function capture(archive) {
  var chunks = [];
  archive.write = function (chunk) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };
  return function () {
    return Buffer.concat(chunks);
  };
}

describe("ZIP64 records", function () {
  this.timeout(30000);
  before(function () {
    mkdirSync("tmp", { recursive: true });
  });

  [0, 8].forEach(function (method) {
    [false, true].forEach(function (forced) {
      it(
        "writes readable " +
          (forced ? "forced ZIP64" : "ordinary ZIP") +
          " method " +
          method,
        async function () {
          var payload = Buffer.from("ZIP64 content control\n");
          var buffer = await archiveBuffer(
            { forceZip64: forced },
            1,
            method,
            payload,
          );
          var entry = directory(buffer, 1, forced)[0];
          assert.equal(entry.name, "entry-0.txt");
          assert.equal(entry.method, method);
          assert.equal(entry.size, payload.length);
          var data =
            entry.local +
            30 +
            buffer.readUInt16LE(entry.local + 26) +
            buffer.readUInt16LE(entry.local + 28);
          var compressed = buffer.subarray(data, data + entry.compressedSize);
          assert.deepEqual(
            method === 8 ? inflateRawSync(compressed) : compressed,
            payload,
          );
          writeFileSync("tmp/zip64-" + forced + "-" + method + ".zip", buffer);
        },
      );
    });
  });

  [65534, 65535, 65536].forEach(function (count) {
    it(
      "preserves entry count " + count + " across the 16-bit boundary",
      async function () {
        var buffer = await archiveBuffer({}, count, 0, Buffer.alloc(0));
        var entries = directory(buffer, count, count > 65535);
        assert.equal(entries[0].name, "entry-0.txt");
        assert.equal(entries[count - 1].name, "entry-" + (count - 1) + ".txt");
        writeFileSync("tmp/zip64-count-" + count + ".zip", buffer);
      },
    );
  });

  // These are serialization units, not fabricated multi-gigabyte archives.
  [
    [4294967294, 4294967293, 4294967292, false],
    [4294967297, 4294967298, 4294967299, true],
    [3, 2, 4294967296, true],
    [1099511627783, 8, 7, true],
  ].forEach(function (values) {
    it(
      "serializes central metadata " + values.slice(0, 3).join("/"),
      function () {
        var archive = new ZipArchiveOutputStream();
        var output = capture(archive);
        var entry = new ZipArchiveEntry("metadata.bin");
        entry.setMethod(0);
        entry.setSize(values[0]);
        entry.setCompressedSize(values[1]);
        entry._offsets = { file: values[2] };
        archive._writeCentralFileHeader(entry);
        var buffer = output();
        assert.equal(buffer.readUInt32LE(0), 0x02014b50);
        if (values[3]) {
          assert.equal(buffer.readUInt16LE(6), 45);
          assert.equal(buffer.readUInt32LE(20), 0xffffffff);
          assert.equal(buffer.readUInt32LE(24), 0xffffffff);
          assert.equal(buffer.readUInt32LE(42), 0xffffffff);
          var extra = 46 + buffer.readUInt16LE(28);
          assert.equal(buffer.readUInt16LE(extra), 1);
          assert.equal(buffer.readUInt16LE(extra + 2), 24);
          assert.equal(buffer.readBigUInt64LE(extra + 4), BigInt(values[0]));
          assert.equal(buffer.readBigUInt64LE(extra + 12), BigInt(values[1]));
          assert.equal(buffer.readBigUInt64LE(extra + 20), BigInt(values[2]));
        } else {
          assert.equal(buffer.readUInt16LE(30), 0);
          assert.equal(buffer.readUInt32LE(20), values[1]);
          assert.equal(buffer.readUInt32LE(24), values[0]);
          assert.equal(buffer.readUInt32LE(42), values[2]);
        }
      },
    );
  });

  [false, true].forEach(function (wide) {
    it(
      "serializes " + (wide ? "wide" : "ordinary") + " descriptor metadata",
      function () {
        var archive = new ZipArchiveOutputStream();
        var output = capture(archive);
        var entry = new ZipArchiveEntry("descriptor.bin");
        entry.setCrc(0x12345678);
        entry.setSize(wide ? 4294967297 : 5);
        entry.setCompressedSize(wide ? 4294967298 : 6);
        archive._writeDataDescriptor(entry);
        var buffer = output();
        assert.equal(buffer.readUInt32LE(0), 0x08074b50);
        assert.equal(buffer.readUInt32LE(4), 0x12345678);
        assert.lengthOf(buffer, wide ? 24 : 16);
        if (wide) {
          assert.equal(buffer.readBigUInt64LE(8), 4294967298n);
          assert.equal(buffer.readBigUInt64LE(16), 4294967297n);
        } else {
          assert.equal(buffer.readUInt32LE(8), 6);
          assert.equal(buffer.readUInt32LE(12), 5);
        }
      },
    );
  });

  it("serializes wide directory metadata without large payloads", function () {
    var archive = new ZipArchiveOutputStream();
    var output = capture(archive);
    archive._entries.length = 65536;
    archive._archive.centralOffset = 4294967301;
    archive._archive.centralLength = 4294967305;
    archive._writeCentralDirectoryZip64();
    archive._writeCentralDirectoryEnd();
    var buffer = output();
    assert.equal(buffer.readUInt32LE(0), 0x06064b50);
    assert.equal(buffer.readBigUInt64LE(24), 65536n);
    assert.equal(buffer.readBigUInt64LE(32), 65536n);
    assert.equal(buffer.readBigUInt64LE(40), 4294967305n);
    assert.equal(buffer.readBigUInt64LE(48), 4294967301n);
    assert.equal(buffer.readUInt32LE(56), 0x07064b50);
    assert.equal(buffer.readBigUInt64LE(64), 8589934606n);
    assert.equal(buffer.readUInt32LE(76), 0x06054b50);
    assert.equal(buffer.readUInt32LE(88), 0xffffffff);
    assert.equal(buffer.readUInt32LE(92), 0xffffffff);
  });
});
