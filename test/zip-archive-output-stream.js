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
  });
});
