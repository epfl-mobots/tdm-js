/*

Communication with a Thymio via the Thymio Device Manager
Based on https://github.com/Mobsya/thymio-js-api-demo/blob/master/src/index.js
API js: https://mobsya.github.io/aseba/js/index.html

Copyright 2019 Mobsya
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

This is a Derivative Work.
Changes by Mobots, EPFL, 2019-2023

Build:
1. git clone https://github.com/Mobsya/thymio-js-api-demo.git
2. cd thymio-js-api-demo
   check in package.json the line containing "thymio-api"; the version must be "^0.11.0" or more recent
3. npm i
4. replace src/index.js with this file
5. to produce a release version about three times smaller, edit webpack.config.js and
   replace 'mode: "development"' with 'mode: "production"'
5. npm run browser
6. use the resulting dist/thymio.js in your web app:

// default for websocketURL: "ws://localhost:8597" (local tdm)
// options: dict of options (default: none)
// options.password: tdm password (default: none)
// options.uuid: node uuid to connect to, or "auto" to connect automatically to the first node
// (default: don't connect, use tdm.connect(uuid) explicitly, and tdm.close() to close)
// options.change: function(connected) called upon connection change
// options.anyNodeChange: function() called upon any node change
// options.variables: function(v) called upon variable change, or "auto" to only enable this.getVariable
// options.events: function(name,value) called upon event sent by the robot
// default for success (function called once code sent success): null (none)
// default for failure (function called upon failure): null (write error with console.error)
var tdm = new TDM(websocketURL, options);
var b = tdm.canRun();
tdm.run(asebaSourceCode, success, failure);
tdm.close();

// if asebaSourceCode uses custom events in onevent or emit, they should be
// declared with tdm.declareCustomEvents([{name: "...", fixed_size: ...}, ...])
// before calling tdm.run()

*/

import {createClient, Node, NodeStatus, ProgrammingLanguage, Request, setup, mobsya} from '@mobsya-association/thymio-api'

window.TDM = function (url, options) {
    options = options || {};
    this.options = options;

    this.nodes = [];
    this.selectedNode = null;
    this.variables = {};
	this.customEvents = null;	// or [{name: "...", fixed_size: ...}, ...]

    var self = this;

    // Connect to the switch
    // We will need some way to get that url, via the launcher
    let client = createClient(url || "ws://localhost:8597", options.password || "");

    // Start monitotring for node event
    // A node will have the state
    //      * connected    : Connected but vm description unavailable - little can be done in this state
    //      * available    : The node is available, we can start communicating with it
    //      * ready        : We have an excusive lock on the node and can start sending code to it.
    //      * busy         : The node is locked by someone else.
    //      * disconnected : The node is gone
    client.onNodesChanged = async (nodes) => {
        // merge with self.nodes
        nodes.forEach(function (node) {
            var nodeId = node.id.toString();
            var index = self.nodes.findIndex(function (node1) {
                return node1.id.toString() === nodeId;
            });
            if (index < 0) {
                // unknown: add it
                self.nodes.push(node);
            } else {
                // known: replace it
                self.nodes.splice(index, 1, node);
            }
        });
        try {
            // autoconnect
            if (options.uuid && this.selectedNode == null) {
                this.connect(options.uuid);
            }
            options.anyNodeChange && options.anyNodeChange();
        } catch (e) {
            console.log(e)
        }
    };

    client.onClose = async () => {
        if (options.uuid) {
            options.change && options.change(false);
        }
        options.anyNodeChange && options.anyNodeChange();
    };
};

window.TDM.status = {
    // from thymio.fbs
    unknown: 0,
    connected: 1,
    available: 2,
    busy: 3,
    ready: 4,
    disconnected: 5
};

window.TDM.prototype.isConnected = function () {
    return this.selectedNode != null;
};

window.TDM.prototype.setVariables = async function (v) {
    // convert variables from object to map
    var map = new Map();
    for (var v1 in v) {
        if (v.hasOwnProperty(v1)) {
            map.set(v1, v[v1]);
        }
    }

    await this.selectedNode.setVariables(map);
};

window.TDM.prototype.getVariable = function (name) {
    return this.variables[name];
};

window.TDM.prototype.emitEvent = async function (name, value) {
    var map = new Map();
    map.set(name, value == undefined ? null : value);
    await this.selectedNode.emitEvents(map);
};

window.TDM.prototype.canRun = function () {
    return this.selectedNode != null && this.selectedNode.status == NodeStatus.ready;
};

window.TDM.prototype.declareCustomEvents = function (eventsDescr) {
	this.customEvents = eventsDescr;
};

window.TDM.prototype.run = async function (program, success, failure) {
    try {
        if (this.selectedNode == null) {
            // throw string for failure function
            throw "Robot not connected";
        }
        if (this.selectedNode.status == NodeStatus.ready) {
			if (this.customEvents) {
				await this.selectedNode.setEventsDescriptions(this.customEvents);
            }
			await this.selectedNode.sendAsebaProgram(program);
            await this.selectedNode.setScratchPad(program, ProgrammingLanguage.Aseba);
            await this.selectedNode.runProgram();
            success && success();
        }
    } catch(e) {
        if (failure || this.options.failure) {
            (failure || this.options.failure)(e);
        } else {
            console.error(e);
        }
    }
};

window.TDM.prototype.check = async function (program, success, failure) {
    if (this.selectedNode == null) {
        // cannot check
        return;
    }
    try {
        if (this.selectedNode.status == NodeStatus.ready) {
			if (this.customEvents) {
				await this.selectedNode.setEventsDescriptions(this.customEvents);
            }
            await this.selectedNode.sendAsebaProgram(program, true);
            success && success();
        }
    } catch(e) {
        if (failure || this.options.failure) {
            (failure || this.options.failure)(e);
        } else {
            console.error(e);
        }
    }
};

window.TDM.prototype.flash = async function (program, success, failure) {
    try {
        if (this.selectedNode.status == NodeStatus.ready) {
            await this.selectedNode.sendAsebaProgram(program);
            await this.selectedNode.flashProgram();
            success && success();
        }
    } catch(e) {
        if (failure || this.options.failure) {
            (failure || this.options.failure)(e);
        } else {
            console.error(e);
        }
    }
};

// (re)connect to node with specified uuid, or first available node if "auto"
window.TDM.prototype.connect = async function (uuid) {
    if (this.selectedNode) {
        await this.close();
    }
    for (let node of this.nodes) {
        if (this.selectedNode
            && this.selectedNode.id.toString() === node.id.toString()
            && node.status != NodeStatus.ready && node.status != NodeStatus.available) {
            // this.selectedNode lost
            this.selectedNode = null;
            this.options.change && this.options.change(false);
        }
        if ((!this.selectedNode || this.selectedNode.status != NodeStatus.ready)
            && node.status == NodeStatus.available
            && (uuid && (uuid === "auto" || node.id.toString() === uuid))) {
            try {
                this.selectedNode = node;
                console.log(`Locking ${node.id}`)
                // Lock (take ownership) of the node. We cannot mutate a node (send code to it), until we have a lock on it
                // Once locked, a node will appear busy / unavailable to other clients until we close the connection or call `unlock` explicitely
                // We can lock as many nodes as we want
                await node.lock();
                console.log("Node locked");
                this.options.change && this.options.change(true);
            } catch (e) {
                console.log(`Unable to lock ${node.id} (${node.name})`)
            }
        }
        if (this.selectedNode) {
            if (this.options.variables) {
                if (this.options.variables === "auto") {
                    this.selectedNode.onVariablesChanged = (vars) => {
                        // store variables from map to object this.variables as Array<number>
                        vars.forEach((val, key) => {
                            this.variables[key] = val instanceof Number ? [val.valueOf()] : val;
                        });
                    }
                } else {
                    this.selectedNode.onVariablesChanged = (vars) => {
                        // convert variables from map to object
                        var vObj = {};
                        vars.forEach((val, key) => {
                            if (val instanceof Number) {
                                val = [val.valueOf()];
                            }
                            this.variables[key] = val;
                            vObj[key] = val;
                        });

                        this.options.variables(vObj);
                    };
                }
            }
            if (this.options.events) {
                this.selectedNode.onEvents = (events) => {
                    // convert events from map to object
                    var evObj = {};
                    events.forEach((val, key) => {
                        if (val instanceof Number) {
                            val = [val.valueOf()];
                        }
                        this.options.events(key, val);
                    });
                };
            }
            break;
        }
    }
};

window.TDM.prototype.close = async function () {
    if (this.selectedNode) {
        await this.selectedNode.unlock();
        this.selectedNode = null;
    }
};

window.TDM.runOnNode = async function (node, program, success, failure) {
    try {
        await node.lock();
        await node.sendAsebaProgram(program);
        await node.runProgram();
        await node.unlock();
        success && success();
    } catch(e) {
        if (failure || this.options.failure) {
            (failure || this.options.failure)(e);
        } else {
            console.error(e);
        }
    }
};
