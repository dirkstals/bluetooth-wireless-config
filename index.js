// https://support.google.com/chrome/answer/6239299?hl=en

var bleno       = require('bleno'),
    Wireless    = require('wireless'),
    dns         = require('dns'),
    util        = require('util'),
    beacon      = require('eddystone-beacon');

var network,
    ipAddress,
    wireless,
    connected,
    primaryService,
    networkBuffer;
    
var DEVICE_NAME = 'My Device',
    UUID = 'a463a2679afe41e8986ed38aeadfa226',
    CUUID = 'a463a2679afe41e8986ed38aeadfa227',
    IFACE = 'wlan0',
    URL = 'https://www.google.com';


/**
 * @function _init
 * @private
 */
var _init = function(){

    ipAddress = '';
    wireless = new Wireless({iface: IFACE});
    wireless.on('appear', _updateWirelessList);
    wireless.on('vanish', _updateWirelessList);
    wireless.on('join', _stopWirelessScan);
    wireless.on('former', _stopWirelessScan);
    wireless.on('leave', _startWirelessScan)

    // Just for debugging purposes
    wireless.on('command', function(command) {
        console.log("[ COMMAND] " + command);
    });

    wireless.on('error', function(message) {
        console.log("[   ERROR] " + message);
    });

    
    connected = new Promise(_dnsLookup);
    connected.then(_onlineHandler, _offlineHandler);


    bleno.on('advertisingStart', _advertisingStartHandler);
    bleno.on('stateChange', function(state) {

        if (state === 'poweredOn') {

            console.log("[PROGRESS] Starting bluetooth advertising ...");

            bleno.startAdvertising(DEVICE_NAME,[UUID]);
            beacon.advertiseUrl(URL, {name: DEVICE_NAME});
        } else {

            if (state === 'unsupported'){

                console.log("BLE and Bleno configurations not enabled on board");
            }

            console.log("[ FAILURE] Unable to enable bluetooth: " + state);

            bleno.stopAdvertising();
        }
    });
};



/**
 * @function _updateWirelessList
 * @private
 */
var _updateWirelessList = function(network){
    
    networkBuffer = new Buffer(JSON.stringify(wireless.list()));
};


/**
 * @function _startWirelessScan
 * @private
 */
var _startWirelessScan = function(){

    console.log("[PROGRESS] Start scanning...");

    wireless.enable(function(error) {

        if (error) {
            console.log("[ FAILURE] Unable to enable wireless card.");
            return;
        }

        console.log("[PROGRESS] Wireless card enabled.");
        console.log("[PROGRESS] Starting wireless scan...");

        wireless.start();
    });
}


/**
 * @function _stopWirelessScan
 * @private
 */
var _stopWirelessScan = function(){
    
    console.log("[PROGRESS] Stop scanning...");

    wireless.stop();
}



var WirelessCharacteristic = new bleno.Characteristic({
    value : null,
    uuid : CUUID,
    properties : ['read', 'write'],
    
    // Send a message back to the client with the characteristic's value
    onReadRequest : function(offset, callback) {
        
        console.log("Read request received");

        if(offset > networkBuffer.length) {

            callback(this.RESULT_INVALID_OFFSET);
        } else {

            callback(this.RESULT_SUCCESS, networkBuffer.slice(offset));
        }
    },
    
    // Accept a new value for the characterstic's value
    onWriteRequest : function(data, offset, withoutResponse, callback) {

        if(offset > 0) {

            callback(this.RESULT_INVALID_OFFSET);
            return;
        } else {

            network = JSON.parse(data.toString("utf-8"));

            this.value = network.ssid;
            callback(this.RESULT_SUCCESS);

            wireless.join(network.ssid, network.pwd, _joinWirelessNetworkHandler);
        }
    }

})



/**
 * @function _dnsLookup
 * @private
 */
var _dnsLookup = function(resolve, reject){

    dns.lookup('google.com', function(error) {

        if(error && error.code == "ENOTFOUND"){

            reject();
        }else{

            resolve();
        }
    });
};



/**
 * @function _onlineHandler
 * @private
 */
var _onlineHandler = function(){

    _stopWirelessScan();
}


/**
 * @function _offlineHandler
 * @private
 */
var _offlineHandler = function(){

    _startWirelessScan();
}



/**
 * @function _advertisingStartHandler
 * @private
 */
var _advertisingStartHandler = function(error) {

    if (error) {

        console.log("Advertising start error:" + error);
    } else {

        console.log("Advertising start success");

        bleno.setServices([
            
            // Define a new service
            new bleno.PrimaryService({
                uuid : UUID,
                characteristics : [
                    
                    
                    
                ]
            })
        ]);
    }
};

/**
 * @function _joinWirelessNetworkHandler
 * @private
 */
var _joinWirelessNetworkHandler = function(err) {

    if (err) {
        console.log("[   ERROR] Unable to connect.");
        return;
    }

    console.log("Yay, we connected! I will try to get an IP.");

    wireless.dhcp(function(ip_address) {

        console.log("Yay, I got an IP address (" + ipAddress + ")!");
    });
};


_init();



var killing_app = false;
process.on('SIGINT', function() {
    console.log("\n");

    if (killing_app) {
        console.log("[PROGRESS] Double SIGINT, Killing without cleanup!");
        process.exit();
    }

    killing_app = true;
    console.log("[PROGRESS] Gracefully shutting down from SIGINT (Ctrl+C)");
    console.log("[PROGRESS] Disabling Adapter...");

    wireless.disable(function() {
        console.log("[PROGRESS] Stopping and Exiting...");

        wireless.stop();
    });

    bleno.stopAdvertising();
});
