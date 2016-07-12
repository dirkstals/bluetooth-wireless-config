/**
 * Simple bleno echo server
 * Author: Shawn Hymel
 * Date: November 22, 2015
 *
 * Creates a Bluetooth Low Energy device using bleno and offers one service
 * with one characteristic. Users can use a BLE test app to read, write, and
 * subscribe to that characteristic. Writing changes the characteristic's
 * value, reading returns that value, and subscribing results in a string
 * message every 1 second.
 *
 * This example is Beerware (https://en.wikipedia.org/wiki/Beerware).
 */
 
// Using the bleno module
var bleno = require('bleno');
 
// Once bleno starts, begin advertising our BLE address
bleno.on('stateChange', function(state) {
    console.log('State change: ' + state);
    if (state === 'poweredOn') {
        bleno.startAdvertising('MyDevice',['12ab']);
    } else {
        bleno.stopAdvertising();
    }
});
 
// Notify the console that we've accepted a connection
bleno.on('accept', function(clientAddress) {
    console.log("Accepted connection from address: " + clientAddress);
});
 
// Notify the console that we have disconnected from a client
bleno.on('disconnect', function(clientAddress) {
    console.log("Disconnected from address: " + clientAddress);
});
 
// When we begin advertising, create a new service and characteristic
bleno.on('advertisingStart', function(error) {
    if (error) {
        console.log("Advertising start error:" + error);
    } else {
        console.log("Advertising start success");
        bleno.setServices([
            
            // Define a new service
            new bleno.PrimaryService({
                uuid : '12ab',
                characteristics : [
                    
                    // Define a new characteristic within that service
                    new bleno.Characteristic({
                        value : null,
                        uuid : '34cd',
                        properties : ['notify', 'read', 'write'],
                        
                        // If the client subscribes, we send out a message every 1 second
                        onSubscribe : function(maxValueSize, updateValueCallback) {
                            console.log("Device subscribed");
                            this.intervalId = setInterval(function() {
                                console.log("Sending: Hi!");
                                updateValueCallback(new Buffer("Hi!"));
                            }, 1000);
                        },
                        
                        // If the client unsubscribes, we stop broadcasting the message
                        onUnsubscribe : function() {
                            console.log("Device unsubscribed");
                            clearInterval(this.intervalId);
                        },
                        
                        // Send a message back to the client with the characteristic's value
                        onReadRequest : function(offset, callback) {
                            console.log("Read request received");
                            callback(this.RESULT_SUCCESS, new Buffer("Echo: " + 
                                    (this.value ? this.value.toString("utf-8") : "")));
                        },
                        
                        // Accept a new value for the characterstic's value
                        onWriteRequest : function(data, offset, withoutResponse, callback) {
                            this.value = data;
                            console.log('Write request: value = ' + this.value.toString("utf-8"));
                            callback(this.RESULT_SUCCESS);
                        }
 
                    })
                    
                ]
            })
        ]);
    }
});

var Wireless = require('wireless');
var fs = require('fs');

var connected = false;
var SSID = 'Stable';
var wireless = new Wireless({
    iface: 'wlan0',
    updateFrequency: 10, // Optional, seconds to scan for networks
    connectionSpyFrequency: 2, // Optional, seconds to scan if connected
    vanishThreshold: 2 // Optional, how many scans before network considered gone
});

wireless.enable(function(err) {
    wireless.start();
});


// Found a new network
wireless.on('appear', function(network) {
    var quality = Math.floor(network.quality / 70 * 100);

    var ssid = network.ssid || '<HIDDEN>';

    var encryption_type = 'NONE';
    if (network.encryption_wep) {
        encryption_type = 'WEP';
    } else if (network.encryption_wpa && network.encryption_wpa2) {
        encryption_type = 'WPA&WPA2';
    } else if (network.encryption_wpa) {
        encryption_type = 'WPA';
    } else if (network.encryption_wpa2) {
        encryption_type = 'WPA2';
    }

    console.log("[  APPEAR] " + ssid + " [" + network.address + "] " + quality + "% " + network.strength + " dBm " + encryption_type);

    if (!connected && network.ssid === SSID) {
        connected = true;
        wireless.join(network, '', function(err) {
            if (err) {
                console.log("[   ERROR] Unable to connect.");
                return;
            }

            console.log("Yay, we connected! I will try to get an IP.");
            wireless.dhcp(function(ip_address) {
                console.log("Yay, I got an IP address (" + ip_address + ")! I'm going to disconnect in 20 seconds.");

                setTimeout(function() {
                    console.log("20 seconds are up! Attempting to turn off DHCP...");

                    wireless.dhcpStop(function() {
                        console.log("DHCP has been turned off. Leaving the network...");

                        wireless.leave();
                    });
                }, 20 * 1000);
            });
        });
    }
});

// A network disappeared (after the specified threshold)
wireless.on('vanish', function(network) {
    console.log("[  VANISH] " + network.ssid + " [" + network.address + "] ");
});

// A wireless network changed something about itself
wireless.on('change', function(network) {
    console.log("[  CHANGE] " + network.ssid);
});

wireless.on('signal', function(network) {
    console.log("[  SIGNAL] " + network.ssid);
});

// We've joined a network
wireless.on('join', function(network) {
    console.log("[    JOIN] " + network.ssid + " [" + network.address + "] ");
});

// You were already connected, so it's not technically a join event...
wireless.on('former', function(address) {
    console.log("[OLD JOIN] " + address);
});

// We've left a network
wireless.on('leave', function() {
    console.log("[   LEAVE] Left the network");
});

// Just for debugging purposes
wireless.on('command', function(command) {
    console.log("[ COMMAND] " + command);
});

wireless.on('dhcp', function(ip_address) {
    console.log("[    DHCP] Leased IP " + ip_address);
});

/*
wireless.on('batch', function(networks) {
    console.log("[   BATCH] " + networks);
});
*/

wireless.on('empty', function() {
    console.log("[   EMPTY] Found no networks this scan");
});

wireless.on('error', function(message) {
    console.log("[   ERROR] " + message);
});
