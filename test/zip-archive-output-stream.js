/*global before,describe,it */
var fs = require('fs');
var assert = require('chai').assert;
var mkdir = require('mkdirp');

var commons = require('../lib/compress-commons');
var ZipArchiveEntry = commons.ZipArchiveEntry;
var ZipArchiveOutputStream = commons.ZipArchiveOutputStream;

var outputStream = new ZipArchiveOutputStream();
var testDate = new Date('Jan 03 2013 14:26:38 GMT');

describe('ZipArchiveOutputStream', function() {

  before(function() {
    mkdir.sync('tmp');
  });

  describe('#entry', function() {
    var fsOut = fs.createWriteStream('tmp/put.zip');

    outputStream.pipe(fsOut);

    var zae = new ZipArchiveEntry('file.txt');
    zae.setMethod(0);

    outputStream.entry(zae, 'abc123', function(err) {
      if (err) {
        throw err;
      }

      console.log(outputStream._archive);
      console.log(outputStream._entry);
      outputStream.finish();

      // console.log(outputStream._entries);
    });
  });

});