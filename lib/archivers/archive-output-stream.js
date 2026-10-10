import { inherits } from "util";
import { isStream } from "is-stream";
import { Transform } from "readable-stream";
import ArchiveEntry from "./archive-entry.js";
import { normalizeInputSource } from "../util/index.js";

export default class ArchiveOutputStream extends Transform {
  constructor(options) {
    super(options);

    this.offset = 0;
    this._archive = {
      finish: false,
      finished: false,
      processing: false,
    };
  }

  _appendBuffer(zae, source, callback) {
    // scaffold only
  }

  _appendStream(zae, source, callback) {
    // scaffold only
  }

  _emitErrorCallback = function (err) {
    if (err && !this.destroyed) {
      this.emit("error", err);
    }
  };

  _finish(ae) {
    // scaffold only
  }

  _normalizeEntry(ae) {
    // scaffold only
  }

  _transform(chunk, encoding, callback) {
    callback(null, chunk);
  }

  entry(ae, source, callback) {
    source = source || null;
    if (typeof callback !== "function") {
      callback = this._emitErrorCallback.bind(this);
    }
    if (this.destroyed) {
      var error = new Error("cannot append an entry after destroy");
      error.code = "ERR_STREAM_DESTROYED";
      callback(error);
      return;
    }
    if (!(ae instanceof ArchiveEntry)) {
      callback(new Error("not a valid instance of ArchiveEntry"));
      return;
    }
    if (this._archive.finish || this._archive.finished) {
      callback(new Error("unacceptable entry after finish"));
      return;
    }
    if (this._archive.processing) {
      callback(new Error("already processing an entry"));
      return;
    }
    var entryCallback = callback;
    var completed = false;
    callback = function (err, entry) {
      if (completed) {
        return;
      }
      completed = true;
      this._abortEntry = null;
      entryCallback(err, entry);
    }.bind(this);
    this._abortEntry = callback;
    this._archive.processing = true;
    this._normalizeEntry(ae);
    this._entry = ae;
    source = normalizeInputSource(source);
    if (Buffer.isBuffer(source)) {
      this._appendBuffer(ae, source, callback);
    } else if (isStream(source)) {
      this._appendStream(ae, source, callback);
    } else {
      this._archive.processing = false;
      callback(
        new Error("input source must be valid Stream or Buffer instance"),
      );
      return;
    }
    return this;
  }

  finish() {
    if (this.destroyed) {
      return;
    }
    if (this._archive.processing) {
      this._archive.finish = true;
      return;
    }
    this._finish();
  }

  getBytesWritten() {
    return this.offset;
  }

  write(chunk, cb) {
    if (chunk) {
      this.offset += chunk.length;
    }
    return super.write(chunk, cb);
  }
}
