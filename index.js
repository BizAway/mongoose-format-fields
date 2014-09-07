var util = require('util'),
    extend = require('extend');

var format_fields_plugin = function (schema, options) {

    var getGrants = function (options) {
        var requested_grants = (options.grants) ? options.grants: null;
        if (!util.isArray(requested_grants)) {
            requested_grants = [requested_grants];
        }

        return requested_grants;
    }

    var checkFields = function (paths, entity, grants) {
        var output = {};
        Object.keys(paths).forEach(function (name) {
            if (paths[name].schema) {
                var requested_grants = getGrants(paths[name].schema.options);
            } else {
                var requested_grants = getGrants(paths[name].options);
            }

            for (var n = 0; n < grants.length; n++) {
                if (requested_grants.indexOf(grants[n]) >= 0) {
                    output[name] = entity[name]
                    break;
                }
            }
        });

        return output;
    }

    schema.static('format', function (entity, grants) {

        if (!grants || !util.isArray(grants))
            grants = [];

        grants.push("public");

        return checkFields(schema.paths, entity, grants);
    });

    schema.methods.format = function (grants) {
        return schema.statics.format.call(this, this, grants);
    };
};

module.exports = exports = format_fields_plugin;