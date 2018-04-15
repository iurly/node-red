/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

 /**
  * @namespace RED.flows
  */

/**
 * @typedef Flows
 * @alias Dave
 * @type {object}
 * @property {string} rev - the flow revision identifier
 * @property {Array}  flows - the flow configuration, an array of node configuration objects
 */

/**
 * @typedef Flow
 * @type {object}
 * @property {string} id - the flow identifier
 * @property {string} label - a label for the flow
 * @property {Array}  nodes - an array of node configuration objects
 */

var runtime;

var api = module.exports = {
    init: function(_runtime) {
        runtime = _runtime;
    },
    /**
    * Gets the current flow configuration
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @return {Promise<Flows>} - the active flow configuration
    * @memberof RED.flows
    */
    getFlows: function(opts) {
        return new Promise(function(resolve,reject) {
            runtime.log.audit({event: "flows.get"}/*,req*/);
            var version = opts.version||"v1";
            return resolve(runtime.nodes.getFlows());
        });
    },
    /**
    * Sets the current flow configuration
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @return {Promise<Flows>} - the active flow configuration
    * @memberof RED.flows
    */
    setFlows: function(opts) {
        var err;
        return new Promise(function(resolve,reject) {

            var flows = opts.flows;
            var deploymentType = opts.deploymentType||"full";
            runtime.log.audit({event: "flows.set",type:deploymentType}/*,req*/);

            var apiPromise;
            if (deploymentType === 'reload') {
                apiPromise = runtime.nodes.loadFlows();
            } else {
                if (flows.hasOwnProperty('rev')) {
                    var currentVersion = runtime.nodes.getFlows().rev;
                    if (currentVersion !== flows.rev) {
                        err = new Error();
                        err.code = "version_mismatch";
                        err.status = 409;
                        //TODO: log warning
                        return reject(err);
                    }
                }
                apiPromise = runtime.nodes.setFlows(flows.flows,deploymentType);
            }
            apiPromise.then(function(flowId) {
                return resolve({rev:flowId});
            }).catch(function(err) {
                log.warn(log._("api.flows.error-"+(deploymentType === 'reload'?'reload':'save'),{message:err.message}));
                log.warn(err.stack);
                return reject(err);
            });
        });
    },

    /**
    * Adds a flow configuration
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @param {Object} opts.flow - the flow to add
    * @return {Promise<String>} - the id of the added flow
    * @memberof RED.flows
    */
    addFlow: function(opts) {
        return new Promise(function(resolve,reject) {
            var flow = opts.flow;
            runtime.nodes.addFlow(flow).then(function(id) {
                runtime.log.audit({event: "flow.add",id:id});
                return resolve(id);
            }).catch(function(err) {
                runtime.log.audit({event: "flow.add",error:err.code||"unexpected_error",message:err.toString()});
                err.status = 400;
                return reject(err);
            })
        })


    },

    /**
    * Gets an individual flow configuration
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @param {Object} opts.id - the id of the flow to retrieve
    * @return {Promise<Flow>} - the active flow configuration
    * @memberof RED.flows
    */
    getFlow: function(opts) {
        return new Promise(function (resolve,reject) {
            var flow = runtime.nodes.getFlow(opts.id);
            if (flow) {
                runtime.log.audit({event: "flow.get",id:opts.id});
                return resolve(flow);
            } else {
                runtime.log.audit({event: "flow.get",id:opts.id,error:"not_found"});
                var err = new Error();
                err.status = 404;
                return reject(err);
            }
        })

    },
    /**
    * Updates an existing flow configuration
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @param {Object} opts.id - the id of the flow to update
    * @param {Object} opts.flow - the flow configuration
    * @return {Promise<String>} - the id of the updated flow
    * @memberof RED.flows
    */
    updateFlow: function(opts) {
        return new Promise(function (resolve,reject) {
            var flow = opts.flow;
            var id = opts.id;
            try {
                runtime.nodes.updateFlow(id,flow).then(function() {
                    runtime.log.audit({event: "flow.update",id:id});
                    return resolve(id);
                }).catch(function(err) {
                    runtime.log.audit({event: "flow.update",error:err.code||"unexpected_error",message:err.toString()});
                    err.status = 400;
                    return reject(err);
                })
            } catch(err) {
                if (err.code === 404) {
                    runtime.log.audit({event: "flow.update",id:id,error:"not_found"});
                    // TODO: this swap around of .code and .status isn't ideal
                    err.status = 404;
                    err.code = "not_found";
                    return reject(err);
                } else {
                    runtime.log.audit({event: "flow.update",error:err.code||"unexpected_error",message:err.toString()});
                    err.status = 400;
                    return reject(err);
                }
            }
        });

    },
    /**
    * Deletes a flow
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @param {Object} opts.id - the id of the flow to delete
    * @return {Promise} - resolves if successful
    * @memberof RED.flows
    */
    deleteFlow: function(opts) {
        return new Promise(function (resolve,reject) {
            var id = opts.id;
            try {
                runtime.nodes.removeFlow(id).then(function() {
                    log.audit({event: "flow.remove",id:id});
                    return resolve();
                })
            } catch(err) {
                if (err.code === 404) {
                    log.audit({event: "flow.remove",id:id,error:"not_found"});
                    // TODO: this swap around of .code and .status isn't ideal
                    err.status = 404;
                    err.code = "not_found";
                    return reject(err);
                } else {
                    log.audit({event: "flow.remove",id:id,error:err.code||"unexpected_error",message:err.toString()});
                    err.status = 400;
                    return reject(err);
                }
            }
        });
    },

    /**
    * Gets the safe credentials for a node
    * @param {Object} opts
    * @param {User} opts.user - the user calling the api
    * @param {String} opts.type - the node type to return the credential information for
    * @param {String} opts.id - the node id
    * @return {Promise<Object>} - the safe credentials
    * @memberof RED.flows
    */
    getNodeCredentials: function(opts) {
        return new Promise(function(resolve,reject) {
            log.audit({event: "credentials.get",type:opts.type,id:opts.id});
            var credentials = runtime.nodes.getCredentials(opts.id);
            if (!credentials) {
                return resolve({});
            }
            var definition = runtime.nodes.getCredentialDefinition(opts.type);

            var sendCredentials = {};
            for (var cred in definition) {
                if (definition.hasOwnProperty(cred)) {
                    if (definition[cred].type == "password") {
                        var key = 'has_' + cred;
                        sendCredentials[key] = credentials[cred] != null && credentials[cred] !== '';
                        continue;
                    }
                    sendCredentials[cred] = credentials[cred] || '';
                }
            }
            resolve(sendCredentials);
        })
    }

}
