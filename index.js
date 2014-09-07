var util = require('util'),
    extend = require('extend');

var format_fields_plugin = function (schema, options) {

    var getGrants = function (options) {
        var requested_grants = (options.grants) ? options.grants: null;
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
                output[name] = entity[name]
            }
        });

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