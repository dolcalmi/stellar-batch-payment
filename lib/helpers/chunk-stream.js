'use strict';

const stream = require('stream');
const util = require('util');

function ChunkStream (size) {

  this._buffer = [];
  this._size = size;

  stream.Transform.call(this, { objectMode: true });
}

util.inherits(ChunkStream, stream.Transform);

ChunkStream.prototype._transform = function (chunk, encoding, done) {

  const generateMore = () => {
    if (this._buffer.length == this._size) {
      const shouldContinue = this.push(this._buffer);
      this._buffer = [];
      if(!shouldContinue) {
        return this._readableState.pipes.once('drain', generateMore);
      }
    }

    const isBuffer = Buffer.isBuffer(chunk);
    this._buffer.push(isBuffer ? JSON.parse(chunk.toString('utf8')) : chunk);
    done();
  }

  generateMore();
};

ChunkStream.prototype._flush = function () {
  this.push(this._buffer);
};

module.exports = ChunkStream;
