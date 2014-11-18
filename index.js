var util = require('util'),
    extend = require('extend');

var format_fields_plugin = function (schema, options) {

    var getGrants = function (options) {
        if (options.grants) {
            var requested_grants = options.grants;
        } else if (options.type && options.type[0] && options.type[0].grants) {
            var requested_grants = options.type[0].grants;
        } else {
            var requested_grants = null;
        }

        if (!util.isArray(requested_grants) && requested_grants != null) {
            requested_grants = [requested_grants];
        }

        return requested_grants;
    }

    var isAllowed = function (requested_grants, grants) {
        for (var n = 0; n < grants.length; n++) {
            if (requested_grants.indexOf(grants[n]) >= 0) {
                return true;
            }
        }
        return false;
    }

    var checkFields = function (schema, entity, grants) {
        var output = {},
            paths = schema.paths;

        if (schema.options.id_grants) {
            var requested_grants = (schema.options.id_grants) ? schema.options.id_grants: null;
            if (!util.isArray(requested_grants) && requested_grants != null) {
                requested_grants = [requested_grants];
            }
            if (requested_grants && isAllowed(requested_grants, grants)) {
                if (schema.options.id_output) {
                    output[schema.options.id_output] = entity['_id'];
                } else {
                    output['_id'] = entity['_id'];
                }
            }
        }
        Object.keys(paths).forEach(function (name) {
            if (paths[name].schema) {
                var requested_grants = getGrants(paths[name].schema.options);
            } else {
                var requested_grants = getGrants(paths[name].options);
            }
            if (requested_grants && isAllowed(requested_grants, grants)) {
                var arrName = name.split('.');
                var first = arrName[0];
                var second = arrName[1];
                var third = arrName[2];
                var fourth = arrName[3];
                var fifth = arrName[4];
                if (entity[first] != undefined) {
                    if (fifth) {
                        if (!output[first]) {
                            output[first] = {};
                        }
                        if (!output[first][second]) {
                            output[first][second] = {};
                        }
                        if (!output[first][second][third]) {
                            output[first][second][third] = {};
                        }
                        if (!output[first][second][third][fourth]) {
                            output[first][second][third][fourth] = {};
                        }
                        output[first][second][third][fourth][fifth] = entity[first][second][third][fourth][fifth];
                    } else if (fourth) {
                        if (!output[first]) {
                            output[first] = {};
                        }
                        if (!output[first][second]) {
                            output[first][second] = {};
                        }
                        if (!output[first][second][third]) {
                            output[first][second][third] = {};
                        }
                        output[first][second][third][fourth] = entity[first][second][third][fourth];
                    } else if (third) {
                        if (!output[first]) {
                            output[first] = {};
                        }
                        if (!output[first][second]) {
                            output[first][second] = {};
                        }
                        output[first][second][third] = entity[first][second][third];
                    } else if (second) {
                        if (!output[first]) {
                            output[first] = {};
                        }
                        output[first][second] = entity[first][second];
                    } else {
                        output[first] = entity[first];
                    }
                }
            }
        });

        console.log(output);

        return output;
    }

    schema.static('format', function (entity, grants) {

        if (!grants || !util.isArray(grants))
            grants = [];

        grants.push("public");

        return checkFields(schema, entity, grants);
    });

    schema.methods.format = function (grants) {
        return schema.statics.format.call(this, this, grants);
    };
};

module.exports = exports = format_fields_plugin;