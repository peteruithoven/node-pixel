global.IS_TEST_MODE = true;
var mocks = require("mock-firmata");
var MockFirmata = mocks.Firmata;
var MockSerialPort = mocks.SerialPort;

var sinon = require("sinon");

var five = require("johnny-five");
var pixel = require("../lib/pixel.js");

var Board = five.Board;

function newBoard() {
    var sp = new MockSerialPort("/dev/test");
    var io = new MockFirmata(sp);

    io.emit("connect");
    io.emit("ready");

    var board = new Board({
        io: io,
        debug: false,
        repl: false,
    });

    return board;
}

function restore(target) {
    for (var prop in target) {

        if (Array.isArray(target[prop])) {
            continue;
        }

        if (target[prop] != null && typeof target[prop].restore === "function") {
            target[prop].restore();
        }

        if (typeof target[prop] === "object") {
            restore(target[prop]);
        }
    }
}

exports["Strip - Firmata"] = {
    setUp: function(done){

        this.write = sinon.stub(MockSerialPort.prototype, "write", function(buffer, callback) {
            if (typeof callback === "function") {
                process.nextTick(callback);
            } else {
                return;
            }
        });

        this.board = newBoard();
        done();
    },

    tearDown: function(done) {
        Board.purge();
        restore(this);
        done();
    },

    stripReady: function(test) {
        // tests if the strip emits the ready event properly.
        test.expect(2);

        var strip = new pixel.Strip({
            data: 6,
            length: 8,
            board: this.board,
            controller: "FIRMATA",
        });

        test.equal(this.write.callCount, 1,
                "During initialisation serial write should occur only once");

        strip.on("ready", function() {
            test.ok(true, "If initialisation is complete a ready event should be emitted");
            test.done();
        });
    },

    maxNumberOfStrips: function(test) {
        test.expect(1);

        test.throws(
            () => {
                var strip = new pixel.Strip({
                    board: this.board,
                    controller: "FIRMATA",
                    strips: [8, 8, 8, 8, 8, 8, 8, 8, 8]
                });
            },
            (err) => {
                if (err instanceof RangeError) {
                    return true;
                }
            },
            "Excessive number of strips should throw a RangeError"
        );

        test.done();
    },

    maxNumberOfPixels: function(test) {
        test.expect(2);

        test.throws(
            () => {
                var strip1 = new pixel.Strip({
                    board: this.board,
                    controller: "FIRMATA",
                    strips: [ {pin: 6, length: 300}, ]
                });
            },
            (err) => {
                if (err instanceof RangeError) {
                    return true;
                }
            },
            "Excess pixels in a single strip should throw a RangeError"
        );

        test.throws(
            () => {
                var strip2 = new pixel.Strip({
                    board: this.board,
                    controller: "FIRMATA",
                    strips: [   {pin: 2, length: 64},
                                {pin: 2, length: 64},
                                {pin: 2, length: 64},
                                {pin: 2, length: 64},
                                {pin: 2, length: 64},
                            ], // more than 256
                });
            },
            (err) => {
                if (err instanceof RangeError) {
                    return true;
                }
            },
            "Excess pixels in multiple strips should throw a RangeError"
        );
        test.done();

    },

    show: function(test) {
        // tests if the strip calls the show out to I2C properly.
        //
        test.expect(2);

        var strip = new pixel.Strip({
            data: 6,
            length: 8,
            board: this.board,
            controller: "FIRMATA",
        });

        strip.on("ready", function() {
            test.equal(this.write.callCount, 1,
                    "Firmata should call serial write only once during setup");
            strip.show();
            test.equal(this.write.callCount, 2,
                    "Show should call serial write once after setup is complete.");
            test.done();
        }.bind(this));
    }
};

exports["Pixel - Firmata"] = {
    setUp: function(done){

        this.write = sinon.stub(MockSerialPort.prototype, "write", function(buffer, callback) {
            if (typeof callback === "function") {
                process.nextTick(callback);
            } else {
                return;
            }
        });

        this.board = newBoard();

        this.strip = new pixel.Strip({
            data: 6,
            length: 4,
            board: this.board,
            controller: "FIRMATA",
        });

        done();
    },

    tearDown: function(done) {
        Board.purge();
        restore(this);
        done();
    },

    writing: function(test) {
        // tests to see whether the write to the pixel is going out properly
        test.expect(1);
        this.strip.pixel(0).color("#FFF");
        test.equal(this.write.callCount, 2,
                "Setting the pixel value should make a single serial call");
        test.done()
    },
};

