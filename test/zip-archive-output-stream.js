import { createReadStream } from "fs";
import { Stream, Transform } from "stream";
import { assert } from "chai";
import { mkdirp } from "mkdirp";
import { Readable } from "readable-stream";
import { WriteHashStream, binaryBuffer } from "./helpers/index.js";
import {
  ZipArchiveEntry,
  ZipArchiveOutputStream,
} from "../lib/compress-commons.js";

var testBuffer = binaryBuffer(1024 * 16);
var testDate = new Date("Jan 03 2013 14:26:38 GMT");

describe("ZipArchiveOutputStream", function () {
  before(function () {
    mkdirp.sync("tmp");
  });
  describe("#entry", function () {
    it("should append Buffer sources", function (done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream("tmp/zip-buffer.zip");
      var entry = new ZipArchiveEntry("buffer.txt");
      testStream.on("close", function () {
        done();
      });
      archive.pipe(testStream);
      archive.entry(entry, testBuffer).finish();
    });
    it("should append Stream sources", function (done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream("tmp/zip-stream.zip");
      var entry = new ZipArchiveEntry("stream.txt");
      testStream.on("close", function () {
        done();
      });
      archive.pipe(testStream);
      archive.entry(entry, createReadStream("test/fixtures/test.txt")).finish();
    });
    it("should append Stream-like sources", function (done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream("tmp/zip-stream-like.zip");
      var entry = new ZipArchiveEntry("stream-like.txt");
      testStream.on("close", function () {
        done();
      });
      archive.pipe(testStream);
      archive.entry(entry, Readable.from(["test"])).finish();
    });
    it("should stop streaming on Stream error", function (done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream("tmp/zip-stream.zip");
      var entry = new ZipArchiveEntry("stream.txt");
      var callbackError = null;
      var callbackCalls = 0;
      testStream.on("close", function () {
        assert.equal(callbackError.message, "something went wrong");
        assert.equal(callbackCalls, 1);
        done();
      });
      archive.pipe(testStream);
      var file = new Transform();
      archive.entry(entry, file, function (err) {
        callbackCalls += 1;
        callbackError = err;
      });
      archive.finish();
      process.nextTick(function () {
        file.emit("error", new Error("something went wrong"));
      });
    });
    it("should append multiple sources", function (done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream("tmp/zip-multiple.zip");
      var entry = new ZipArchiveEntry("string.txt");
      var entry2 = new ZipArchiveEntry("buffer.txt");
      var entry3 = new ZipArchiveEntry("stream.txt");
      var entry4 = new ZipArchiveEntry("stream-store.png");
      entry4.setMethod(0);
      var entry5 = new ZipArchiveEntry("buffer-store.txt");
      entry5.setMethod(0);
      testStream.on("close", function () {
        done();
      });
      archive.pipe(testStream);
      archive.entry(entry, "string", function (err) {
        if (err) throw err;
        archive.entry(entry2, testBuffer, function (err) {
          if (err) throw err;
          archive.entry(
            entry3,
            createReadStream("test/fixtures/test.txt"),
            function (err) {
              if (err) throw err;
              archive.entry(
                entry4,
                createReadStream("test/fixtures/image.png"),
                function (err) {
                  if (err) throw err;
                  archive.entry(entry5, testBuffer, function (err) {
                    if (err) throw err;
                    archive.finish();
                  });
                },
              );
            },
          );
        });
      });
    });
    it("should force ZIP64", function (done) {
      var archive = new ZipArchiveOutputStream({
        forceZip64: true,
      });
      var testStream = new WriteHashStream("tmp/zip-stream64.zip");
      var entry = new ZipArchiveEntry("stream.txt");
      testStream.on("close", function () {
        done();
      });
      archive.pipe(testStream);
      archive.entry(entry, createReadStream("test/fixtures/test.txt")).finish();
    });
    it("should honor backpressure while writing the central directory", function (done) {
      this.timeout(10000);
      var entryCount = 2000;
      var archive = new BackpressureZipArchiveOutputStream();
      var chunks = [];
      archive.on("data", function (chunk) {
        chunks.push(chunk);
      });
      archive.on("end", function () {
        var output = Buffer.concat(chunks);
        var names = getCentralDirectoryNames(output);
        assert.equal(archive.centralDirectoryWrites, entryCount);
        assert.equal(archive.drainEvents, entryCount);
        assert.lengthOf(names, entryCount);
        assert.equal(names[0], "entry-0.txt");
        assert.equal(
          names[entryCount - 1],
          "entry-" + (entryCount - 1) + ".txt",
        );
        done();
      });
      for (var i = 0; i < entryCount; i++) {
        var entry = new ZipArchiveEntry("entry-" + i + ".txt");
        archive.entry(entry, Buffer.alloc(0));
      }
      archive.finish();
    });
  });
});

class BackpressureZipArchiveOutputStream extends ZipArchiveOutputStream {
  constructor() {
    super();
    this.centralDirectoryWrites = 0;
    this.drainEvents = 0;
    this.waitingForDrain = false;
  }

  write(chunk, callback) {
    var isCentralDirectoryHeader =
      Buffer.isBuffer(chunk) &&
      chunk.length >= 4 &&
      chunk.readUInt32LE(0) === 0x02014b50;
    if (!isCentralDirectoryHeader) {
      return super.write(chunk, callback);
    }
    assert.isFalse(this.waitingForDrain);
    super.write(chunk, callback);
    this.centralDirectoryWrites += 1;
    this.waitingForDrain = true;
    setImmediate(
      function () {
        this.waitingForDrain = false;
        this.drainEvents += 1;
        this.emit("drain");
      }.bind(this),
    );
    return false;
  }
}

function getCentralDirectoryNames(output) {
  var endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  var endOffset = output.lastIndexOf(endSignature);
  assert.isAtLeast(endOffset, 0);
  var entryCount = output.readUInt16LE(endOffset + 10);
  var centralLength = output.readUInt32LE(endOffset + 12);
  var centralOffset = output.readUInt32LE(endOffset + 16);
  var offset = centralOffset;
  var names = [];
  for (var i = 0; i < entryCount; i++) {
    assert.equal(output.readUInt32LE(offset), 0x02014b50);
    var nameLength = output.readUInt16LE(offset + 28);
    var extraLength = output.readUInt16LE(offset + 30);
    var commentLength = output.readUInt16LE(offset + 32);
    names.push(output.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, centralOffset + centralLength);
  return names;
}
