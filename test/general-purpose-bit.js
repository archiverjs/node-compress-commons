import { assert } from "chai";
import GeneralPurposeBit from "../lib/archivers/zip/general-purpose-bit.js";
/*global before,describe,it */

var gpb;
describe("GeneralPurposeBit", function () {
  beforeEach(function () {
    gpb = new GeneralPurposeBit();
  });
  describe("#encode", function () {
    it("should return a Buffer", function () {
      gpb.useDataDescriptor();
      assert.ok(Buffer.isBuffer(gpb.encode()));
    });
  });
  describe("#parse", function () {
    it.skip("should be tested", function () {});
  });
  describe("#setNumberOfShannonFanoTrees", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getNumberOfShannonFanoTrees", function () {
    it.skip("should be tested", function () {});
  });
  describe("#setSlidingDictionarySize", function () {
    it.skip("should be tested", function () {});
  });
  describe("#getSlidingDictionarySize", function () {
    it.skip("should be tested", function () {});
  });
  describe("#useDataDescriptor", function () {
    it.skip("should be tested", function () {});
  });
  describe("#usesDataDescriptor", function () {
    it.skip("should be tested", function () {});
  });
  describe("#useEncryption", function () {
    it.skip("should be tested", function () {});
  });
  describe("#usesEncryption", function () {
    it.skip("should be tested", function () {});
  });
  describe("#useStrongEncryption", function () {
    it.skip("should be tested", function () {});
  });
  describe("#usesStrongEncryption", function () {
    it.skip("should be tested", function () {});
  });
  describe("#useUTF8ForNames", function () {
    it.skip("should be tested", function () {});
  });
  describe("#usesUTF8ForNames", function () {
    it.skip("should be tested", function () {});
  });
});
