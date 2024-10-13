import { assert } from "chai";
import { ZipArchiveEntry } from "../lib/compress-commons.js";
import GeneralPurposeBit from "../lib/archivers/zip/general-purpose-bit.js";
import UnixStat from "../lib/archivers/zip/unix-stat.js";
/*global before,describe,it */

var entry;
// Jan 03 2013 14:26:38 GMT
var testDate = new Date(Date.UTC(2013, 0, 3, 14, 26, 38, 0));

describe("ZipArchiveEntry", function () {
  beforeEach(function () {
    entry = new ZipArchiveEntry("file.txt");
  });
  // Getters
  describe("#getCentralDirectoryExtra", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getComment", function () {
    it("should return the comment", function () {
      entry.setComment("file comment");
      assert.equal(entry.getComment(), "file comment");
    });
  });
  describe("#getCompressedSize", function () {
    it("should return the compressed size", function () {
      entry.csize = 10;
      assert.equal(entry.getCompressedSize(), 10);
    });
  });
  describe("#getCrc", function () {
    it("should return the CRC32", function () {
      entry.crc = 585446183;
      assert.equal(entry.getCrc(), 585446183);
    });
  });
  describe("#getExternalAttributes", function () {
    it("should return the external attributes", function () {
      entry.exattr = 2180972576;
      assert.equal(entry.getExternalAttributes(), 2180972576);
    });
  });
  describe("#getExtra", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getGeneralPurposeBit", function () {
    it("should return the general purpose bit flag", function () {
      var gpb = new GeneralPurposeBit();
      gpb.useDataDescriptor(true);
      entry.gpb = gpb;
      assert.equal(entry.getGeneralPurposeBit(), gpb);
    });
  });
  describe("#getInternalAttributes", function () {
    it("should return the internal attributes", function () {
      entry.inattr = 2180972576;
      assert.equal(entry.getInternalAttributes(), 2180972576);
    });
  });
  describe("#getLastModifiedDate", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getLocalFileDataExtra", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getMethod", function () {
    it("should return the compression method", function () {
      entry.method = 0;
      assert.equal(entry.getMethod(), 0);
    });
  });
  describe("#getName", function () {
    it("should return the name", function () {
      entry.name = "file.txt";
      assert.equal(entry.getName(), "file.txt");
    });
  });
  describe("#getPlatform", function () {
    it("should return the platform", function () {
      entry.platform = 3;
      assert.equal(entry.getPlatform(), 3);
    });
  });
  describe("#getSize", function () {
    it("should return the size", function () {
      entry.size = 25;
      assert.equal(entry.getSize(), 25);
    });
  });
  describe("#getTime", function () {
    it("should return a Date object", function () {
      entry.time = 1109607251;
      assert.typeOf(entry.getTime(), "Date");
    });
  });
  describe("#getTimeDos", function () {
    it("should return a number", function () {
      entry.time = 1109607251;
      assert.typeOf(entry.getTimeDos(), "number");
    });
  });
  describe("#getUnixMode", function () {
    it("should return the unix filemode", function () {
      entry.mode = 511; // 0777
      entry.exattr = 2180972576;
      entry.platform = 3;
      assert.equal(entry.getUnixMode(), 33279); // 0100777
    });
    it("should set proper external attributes for an unix directory", function () {
      entry = new ZipArchiveEntry("directory/");
      entry.setUnixMode(511); // 0777
      assert.ok(entry.getPlatform(), 3);
      assert.ok(entry.isDirectory());
      var exattr = entry.getExternalAttributes() >> 16;
      assert.equal(exattr & 16384, 16384); // 040000
    });
  });
  describe("#getVersionNeededToExtract", function () {
    it.skip("should be tested", function () {});
  });
  // Setters
  describe("#setComment", function () {
    it("should set internal variable", function () {
      entry.setComment("file comment");
      assert.propertyVal(entry, "comment", "file comment");
    });
    it("should set utf8 bit when receiving strings byte count != string length", function () {
      entry.setComment("ÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäçèéêëìíîïñòóôõöùúûüýÿ");
      assert.ok(entry.getGeneralPurposeBit().usesUTF8ForNames());
    });
  });
  describe("#setCompressedSize", function () {
    it("should set internal variable", function () {
      entry.setCompressedSize(10);
      assert.propertyVal(entry, "csize", 10);
    });
  });
  describe("#setCrc", function () {
    it("should set internal variable", function () {
      entry.setCrc(585446183);
      assert.propertyVal(entry, "crc", 585446183);
    });
  });
  describe("#setExternalAttributes", function () {
    it("should set internal variable", function () {
      entry.setExternalAttributes(2180972576);
      assert.propertyVal(entry, "exattr", 2180972576);
    });
  });
  describe("#setExtra", function () {
    it.skip("should be tested", function () {});
  });
  describe("#setGeneralPurposeBit", function () {
    it("should set internal variable", function () {
      var gpb = new GeneralPurposeBit();
      gpb.useDataDescriptor(true);
      entry.setGeneralPurposeBit(gpb);
      assert.propertyVal(entry, "gpb", gpb);
    });
  });
  describe("#setInternalAttributes", function () {
    it("should set internal variable", function () {
      entry.setInternalAttributes(2180972576);
      assert.propertyVal(entry, "inattr", 2180972576);
    });
  });
  describe("#setMethod", function () {
    it("should set internal variable", function () {
      entry.setMethod(8);
      assert.propertyVal(entry, "method", 8);
    });
  });
  describe("#setName", function () {
    it("should set internal variable", function () {
      entry.setName("file.txt");
      assert.propertyVal(entry, "name", "file.txt");
    });
    it("should allow setting prefix of / at the beginning of path", function () {
      entry.setName("file.txt", true);
      assert.propertyVal(entry, "name", "/file.txt");
    });
    it("should allow ./ at the beginning of path", function () {
      entry.setName("./file.txt");
      assert.propertyVal(entry, "name", "./file.txt");
    });
    it("should clean windows style paths", function () {
      entry.setName("\\windows\\file.txt");
      assert.propertyVal(entry, "name", "windows/file.txt");
      entry.setName("c:\\this\\path\\file.txt");
      assert.propertyVal(entry, "name", "this/path/file.txt");
      entry.setName("\\\\server\\share\\");
      assert.propertyVal(entry, "name", "server/share/");
    });
    it("should clean multiple forward slashes at beginning of path", function () {
      entry.setName("//forward/file.txt");
      assert.propertyVal(entry, "name", "forward/file.txt");
    });
    it("should set utf8 bit when receiving strings byte count != string length", function () {
      entry.setName("ÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäçèéêëìíîïñòóôõöùúûüýÿ.txt");
      assert.ok(entry.getGeneralPurposeBit().usesUTF8ForNames());
    });
  });
  describe("#setPlatform", function () {
    it("should set internal variable", function () {
      entry.setPlatform(3);
      assert.propertyVal(entry, "platform", 3);
    });
  });
  describe("#setSize", function () {
    it("should set internal variable", function () {
      entry.setSize(15);
      assert.propertyVal(entry, "size", 15);
    });
  });
  describe("#setTime", function () {
    it("should set internal variable", function () {
      entry.setTime(testDate);
      assert.propertyVal(entry, "time", 1109619539);
    });
  });
  describe("#setUnixMode", function () {
    it("should set internal variables", function () {
      entry.setUnixMode(511);
      assert.propertyVal(entry, "exattr", 2180972576);
      assert.propertyVal(entry, "mode", 511); // 0777
      assert.equal(entry.getUnixMode(), 33279); // 0100777
    });
    it("should also preserve filetype information", function () {
      entry.setUnixMode(41453);
      assert.propertyVal(entry, "exattr", 2716663840);
      assert.propertyVal(entry, "mode", 493); // 0755
      assert.equal(entry.getUnixMode(), 41453); // 0120755
    });
  });
  describe("#setVersionNeededToExtract", function () {
    it.skip("should be tested", function () {});
  });
  // Others
  describe("#isDirectory", function () {
    it("should return a boolean based on name of entry", function () {
      assert.notOk(entry.isDirectory());
      entry.setName("some/directory/");
      assert.ok(entry.isDirectory());
    });
  });
  describe("#isUnixSymlink", function () {
    it("should return a boolean if the entry is a symlink", function () {
      entry.setUnixMode(UnixStat.LINK_FLAG);
      assert.ok(entry.isUnixSymlink());
      entry.setUnixMode(UnixStat.LINK_FLAG | UnixStat.DIR_FLAG);
      assert.notOk(entry.isUnixSymlink());
    });
  });
});
