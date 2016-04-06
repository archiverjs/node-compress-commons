/*global before,describe,it */
var fs = require('fs');
var stream = require('stream');
var assert = require('chai').assert;
var mkdir = require('mkdirp');

var helpers = require('./helpers');
var WriteHashStream = helpers.WriteHashStream;
var testBuffer = helpers.binaryBuffer(1024 * 16);
var testDate = new Date('Jan 03 2013 14:26:38 GMT');

var commons = require('../lib/compress-commons');
var ZipArchiveEntry = commons.ZipArchiveEntry;
var ZipArchiveOutputStream = commons.ZipArchiveOutputStream;

describe('ZipArchiveOutputStream', function() {

  before(function() {
    mkdir.sync('tmp');
  });

  describe('#entry', function() {
    it('should append Buffer sources', function(done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream('tmp/zip-buffer.zip');
      var entry = new ZipArchiveEntry('buffer.txt');

      testStream.on('close', function() {
        done();
      });

      archive.pipe(testStream);

      archive.entry(entry, testBuffer).finish();
    });

    it('should append Stream sources', function(done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream('tmp/zip-stream.zip');
      var entry = new ZipArchiveEntry('stream.txt');

      testStream.on('close', function() {
        done();
      });

      archive.pipe(testStream);

      archive.entry(entry, fs.createReadStream('test/fixtures/test.txt')).finish();
    });

    it('should stop streaming on Stream error', function(done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream('tmp/zip-stream.zip');
      var entry = new ZipArchiveEntry('stream.txt');

      testStream.on('close', function() {
        done();
      });

      archive.pipe(testStream);

      var file = new stream.Transform();
      archive.entry(entry, file, function() {}).finish();
      process.nextTick(function() {
        file.emit('error', new Error('something went wrong'));
      })
    });

    it('should append multiple sources', function(done) {
      var archive = new ZipArchiveOutputStream();
      var testStream = new WriteHashStream('tmp/zip-multiple.zip');

      var entry = new ZipArchiveEntry('string.txt');
      var entry2 = new ZipArchiveEntry('buffer.txt');
      var entry3 = new ZipArchiveEntry('stream.txt');
      var entry4 = new ZipArchiveEntry('stream-store.png');
      entry4.setMethod(0);

      testStream.on('close', function() {
        done();
      });

      archive.pipe(testStream);

      archive.entry(entry, 'string', function(err) {
        if (err) throw err;
        archive.entry(entry2, testBuffer, function(err) {
          if (err) throw err;
          archive.entry(entry3, fs.createReadStream('test/fixtures/test.txt'), function(err) {
            if (err) throw err;
            archive.entry(entry4, fs.createReadStream('test/fixtures/image.png'), function(err) {
              if (err) throw err;
              archive.finish();
            });
          });
        });
      });
    });
  });

});