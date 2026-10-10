import { spawnSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";
import { PassThrough } from "node:stream";
import { setImmediate as nextTurn } from "node:timers/promises";
import { assert } from "chai";
import {
  ZipArchiveEntry,
  ZipArchiveOutputStream,
} from "../lib/compress-commons.js";

function probeSourceClose(method, withError, withCaller, complete) {
  var moduleUrl = new URL("../lib/compress-commons.js", import.meta.url).href;
  var program = `
    import { PassThrough } from "node:stream";
    import { setImmediate as nextTurn } from "node:timers/promises";
    import { ZipArchiveEntry, ZipArchiveOutputStream } from ${JSON.stringify(moduleUrl)};
    var completed = false;
    var releaseClose;
    class FailingCloseSource extends PassThrough {
      _destroy(error, callback) {
        releaseClose = () => callback(new Error("source close failed"));
        if (!${complete} || completed) setImmediate(releaseClose);
      }
    }
    var source = new FailingCloseSource();
    var archive = new ZipArchiveOutputStream();
    var entry = new ZipArchiveEntry("cleanup.txt");
    entry.setMethod(${method});
    var reason = ${withError} ? new Error("consumer stopped") : null;
    var archiveErrors = [], calls = [], sourceErrors = [], sourceCloses = 0;
    var callerError = error => sourceErrors.push(error.message);
    var callerClose = () => sourceCloses++;
    if (${withCaller}) source.on("error", callerError);
    source.on("close", callerClose);
    var sourceClosed = new Promise(resolve => source.once("close", resolve));
    var archiveClosed = new Promise(resolve => archive.once("close", resolve));
    archive.on("error", error => archiveErrors.push(error.message));
    archive.resume();
    archive.entry(entry, source, error => {
      calls.push(error ? { message: error.message, code: error.code ?? null } : null);
      completed = true;
      if (${complete}) {
        if (releaseClose) setImmediate(releaseClose);
        archive.finish();
      }
    });
    if (${complete}) source.end("content");
    else archive.destroy(reason);
    await archiveClosed;
    // Original production does not destroy cancelled inputs: report that defect,
    // rather than wait forever or misrepresent survival as successful cleanup.
    if (source.destroyed) await sourceClosed;
    await nextTurn();
    console.log(JSON.stringify({
      calls, archiveErrors, sourceErrors, sourceCloses,
      sourceDestroyed: source.destroyed,
      reasonChanged: reason ? "code" in reason : false,
      errorListeners: source.listeners("error").length,
      closeListeners: source.listeners("close").length,
      callerErrorPreserved: !${withCaller} || source.listeners("error")[0] === callerError,
      callerClosePreserved: source.listeners("close")[0] === callerClose,
    }));
  `;
  var child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", program],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.isNull(child.error || null, String(child.error));
  assert.strictEqual(child.status, 0, child.stderr);
  var result = JSON.parse(child.stdout.trim());
  assert.isTrue(result.sourceDestroyed);
  assert.equal(result.sourceCloses, 1);
  assert.deepEqual(
    result.sourceErrors,
    withCaller ? ["source close failed"] : [],
  );
  assert.equal(result.errorListeners, withCaller ? 1 : 0);
  assert.equal(result.closeListeners, 1);
  assert.isTrue(result.callerErrorPreserved);
  assert.isTrue(result.callerClosePreserved);
  assert.isFalse(result.reasonChanged);
  if (complete) {
    assert.deepEqual(result.calls, [null]);
    assert.deepEqual(result.archiveErrors, []);
  } else {
    assert.deepEqual(result.calls, [
      {
        message: withError
          ? "consumer stopped"
          : "entry interrupted by archive destruction",
        code: withError ? null : "ERR_STREAM_DESTROYED",
      },
    ]);
    assert.deepEqual(
      result.archiveErrors,
      withError ? ["consumer stopped"] : [],
    );
  }
}

describe("ZipArchiveOutputStream destruction", function () {
  [0, 8].forEach(function (method) {
    [false, true].forEach(function (withError) {
      it(
        "settles an active method " +
          method +
          " entry on destroy, error=" +
          withError,
        async function () {
          var archive = new ZipArchiveOutputStream();
          var source = new PassThrough();
          var sourceErrorListener = function () {};
          source.on("error", sourceErrorListener);
          var entry = new ZipArchiveEntry("pending.txt");
          entry.setMethod(method);
          var reason = withError ? new Error("consumer stopped") : null;
          var errors = [];
          var calls = [];
          archive.on("error", function (error) {
            errors.push(error);
          });
          archive.resume();
          archive.entry(entry, source, function (error) {
            calls.push(error);
          });
          var closed = new Promise(function (resolve) {
            archive.once("close", resolve);
          });
          archive.destroy(reason);
          await closed;
          await nextTurn();
          assert.isTrue(
            source.destroyed,
            "entry source must release its resources",
          );
          assert.lengthOf(calls, 1, "entry callback must settle once");
          if (reason) {
            assert.strictEqual(calls[0], reason);
            assert.notProperty(
              reason,
              "code",
              "preserve a supplied error unchanged",
            );
            assert.deepEqual(errors, [reason]);
          } else {
            assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
            assert.lengthOf(errors, 0);
          }
          assert.equal(source.listenerCount("data"), 0);
          assert.deepEqual(source.listeners("error"), [sourceErrorListener]);
        },
      );
    });
  });

  it("cancels the input when a consumer destroys while receiving a header", async function () {
    var archive = new ZipArchiveOutputStream();
    var source = new PassThrough();
    var calls = [];
    var errors = [];
    archive.on("error", function (error) {
      errors.push(error);
    });
    var closed = new Promise(function (resolve) {
      archive.once("close", resolve);
    });
    archive.once("data", function () {
      archive.destroy();
    });
    archive.entry(new ZipArchiveEntry("pending.txt"), source, function (error) {
      calls.push(error);
    });
    await closed;
    await nextTurn();
    assert.isTrue(source.destroyed);
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
    assert.lengthOf(errors, 0);
  });

  it("settles a stored buffer callback when destroyed during its header", async function () {
    var archive = new ZipArchiveOutputStream();
    var entry = new ZipArchiveEntry("stored.txt");
    entry.setMethod(0);
    var calls = [];
    var errors = [];
    archive.on("error", function (error) {
      errors.push(error);
    });
    var closed = new Promise(function (resolve) {
      archive.once("close", resolve);
    });
    archive.once("data", function () {
      archive.destroy();
    });
    archive.entry(entry, Buffer.from("content"), function (error) {
      calls.push(error);
    });
    await closed;
    await nextTurn();
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
    assert.lengthOf(errors, 0);
  });

  it("emits a destroy error only once with the default entry callback", async function () {
    var archive = new ZipArchiveOutputStream();
    var source = new PassThrough();
    var errors = [];
    var reason = new Error("consumer stopped");
    archive.on("error", function (error) {
      errors.push(error);
    });
    archive.entry(new ZipArchiveEntry("pending.txt"), source);
    var closed = new Promise(function (resolve) {
      archive.once("close", resolve);
    });
    archive.destroy(reason);
    await closed;
    await nextTurn();
    assert.isTrue(source.destroyed);
    assert.deepEqual(errors, [reason]);
  });

  it("settles a pending compressed buffer callback on destroy", async function () {
    var archive = new ZipArchiveOutputStream();
    var calls = [];
    archive.entry(
      new ZipArchiveEntry("buffer.txt"),
      Buffer.alloc(65536),
      function (error) {
        calls.push(error);
      },
    );
    var closed = new Promise(function (resolve) {
      archive.once("close", resolve);
    });
    archive.destroy();
    await closed;
    await nextTurn();
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
  });

  it("rejects new entries after destroy without writing headers", async function () {
    var archive = new ZipArchiveOutputStream();
    var closed = new Promise(function (resolve) {
      archive.once("close", resolve);
    });
    archive.destroy();
    await closed;
    var before = archive.getBytesWritten();
    var calls = [];
    archive.entry(
      new ZipArchiveEntry("late.txt"),
      Buffer.from("late"),
      function (error) {
        calls.push(error);
      },
    );
    archive.finish();
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
    assert.equal(archive.getBytesWritten(), before);
  });

  [
    { name: "stored stream", method: 0, buffer: false },
    { name: "deflated stream", method: 8, buffer: false },
    { name: "compressed buffer", method: 8, buffer: true },
  ].forEach(function (input) {
    [false, true].forEach(function (withError) {
      it(
        "cancels a " +
          input.name +
          " during its descriptor, error=" +
          withError,
        async function () {
          var archive = new ZipArchiveOutputStream();
          var entry = new ZipArchiveEntry("descriptor.txt");
          entry.setMethod(input.method);
          var source = input.buffer
            ? Buffer.from("content")
            : new PassThrough();
          var sourceErrorListener = function () {};
          if (!input.buffer) source.on("error", sourceErrorListener);
          var reason = withError
            ? new Error("consumer stopped on descriptor")
            : null;
          var errors = [];
          var calls = [];
          var writesAfterDestroy = [];
          var compression;
          var originalWrite = archive.write;
          archive.write = function (chunk, callback) {
            if (this.destroyed) writesAfterDestroy.push(chunk);
            return originalWrite.call(this, chunk, callback);
          };
          archive.on("pipe", function (stream) {
            compression = stream;
          });
          archive.on("error", function (error) {
            errors.push(error);
          });
          var closed = new Promise(function (resolve) {
            archive.once("close", resolve);
          });
          archive.on("data", function (chunk) {
            if (chunk.length === 4 && chunk.readUInt32LE(0) === 0x08074b50)
              archive.destroy(reason);
          });
          archive.entry(entry, source, function (error) {
            calls.push(error);
          });
          if (!input.buffer) source.end("content");
          await closed;
          await nextTurn();
          assert.lengthOf(calls, 1);
          if (reason) {
            assert.strictEqual(calls[0], reason);
            assert.notProperty(reason, "code");
            assert.deepEqual(errors, [reason]);
          } else {
            assert.equal(calls[0].code, "ERR_STREAM_DESTROYED");
            assert.lengthOf(errors, 0);
          }
          assert.deepEqual(writesAfterDestroy, []);
          assert.isTrue(compression.destroyed);
          if (!input.buffer) {
            assert.isTrue(source.destroyed);
            assert.deepEqual(source.listeners("error"), [sourceErrorListener]);
            assert.equal(source.listenerCount("data"), 0);
          }
        },
      );
    });

    it(
      "completes a " + input.name + " archive without cancellation",
      async function () {
        var archive = new ZipArchiveOutputStream();
        var entry = new ZipArchiveEntry("complete.txt");
        entry.setMethod(input.method);
        var source = input.buffer ? Buffer.from("content") : new PassThrough();
        var sourceErrorListener = function () {};
        if (!input.buffer) source.on("error", sourceErrorListener);
        var chunks = [];
        var calls = [];
        var ended = new Promise(function (resolve, reject) {
          archive.once("end", resolve);
          archive.once("error", reject);
        });
        archive.on("data", function (chunk) {
          chunks.push(chunk);
        });
        archive.entry(entry, source, function (error) {
          calls.push(error);
          archive.finish();
        });
        if (!input.buffer) source.end("content");
        await ended;
        await nextTurn();
        var zip = Buffer.concat(chunks);
        var dataStart = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
        var payload = zip.subarray(
          dataStart,
          dataStart + entry.getCompressedSize(),
        );
        var content = input.method === 8 ? inflateRawSync(payload) : payload;
        assert.equal(content.toString(), "content");
        assert.deepEqual(calls, [null]);
        assert.equal(
          zip.readUInt32LE(dataStart + entry.getCompressedSize()),
          0x08074b50,
        );
        assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
        assert.equal(archive.getBytesWritten(), zip.length);
      },
    );
  });

  [false, true].forEach(function (withError) {
    it(
      "stops ZIP64 descriptor writes on destroy, error=" + withError,
      async function () {
        var archive = new ZipArchiveOutputStream();
        var entry = new ZipArchiveEntry("large.txt");
        // Exercise real ZIP64 descriptor metadata without generating a 4 GiB input.
        entry.setSize(0x100000000);
        entry.setCompressedSize(0x100000002);
        var reason = withError ? new Error("ZIP64 descriptor stopped") : null;
        var errors = [];
        var writesAfterDestroy = [];
        var originalWrite = archive.write;
        archive.write = function (chunk, callback) {
          if (this.destroyed) writesAfterDestroy.push(chunk);
          return originalWrite.call(this, chunk, callback);
        };
        archive.on("error", function (error) {
          errors.push(error);
        });
        var closed = new Promise(function (resolve) {
          archive.once("close", resolve);
        });
        archive.once("data", function () {
          archive.destroy(reason);
        });
        archive._writeDataDescriptor(entry);
        await closed;
        await nextTurn();
        assert.deepEqual(writesAfterDestroy, []);
        assert.deepEqual(errors, reason ? [reason] : []);
        assert.equal(archive.getBytesWritten(), 4);
      },
    );
  });

  it("preserves the complete ZIP64 descriptor bytes", function () {
    var archive = new ZipArchiveOutputStream();
    var entry = new ZipArchiveEntry("large.txt");
    entry.setCrc(0x12345678);
    entry.setSize(0x100000000);
    entry.setCompressedSize(0x100000002);
    var chunks = [];
    archive.on("data", function (chunk) {
      chunks.push(chunk);
    });
    archive._writeDataDescriptor(entry);
    var descriptor = Buffer.concat(chunks);
    assert.equal(descriptor.length, 24);
    assert.equal(descriptor.readUInt32LE(0), 0x08074b50);
    assert.equal(descriptor.readUInt32LE(4), 0x12345678);
    assert.equal(descriptor.readBigUInt64LE(8), 0x100000002n);
    assert.equal(descriptor.readBigUInt64LE(16), 0x100000000n);
    assert.equal(archive.getBytesWritten(), descriptor.length);
    archive.destroy();
  });

  [0, 8].forEach(function (method) {
    [false, true].forEach(function (withCaller) {
      [false, true].forEach(function (withError) {
        it(
          "owns method " +
            method +
            " cleanup errors through close, caller=" +
            withCaller +
            ", error=" +
            withError,
          function () {
            probeSourceClose(method, withError, withCaller, false);
          },
        );
      });
      it(
        "owns method " +
          method +
          " auto-destroy errors after successful completion, caller=" +
          withCaller,
        function () {
          probeSourceClose(method, false, withCaller, true);
        },
      );
    });
  });
});
