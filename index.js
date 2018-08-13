var util = require('util'),
    extend = require('extend'),
    dot = require('dot-object');

var format_fields_plugin = function (schema) {
    var getGrantsFromOptions = function (name, options) {
        var requested_grants;
        if (options.grants) {
            requested_grants = options.grants;
        } else if (options.type && options.type[0] && options.type[0].grants) {
            requested_grants = options.type[0].grants;
        } else {
            requested_grants = null;
        }

        if (requested_grants && !util.isArray(requested_grants)) {
            requested_grants = [requested_grants];
        }

        return requested_grants;
    };

    var setGrantSchema = function (schema) {
        schema.grantSchema = {};
        for (var name in schema.paths) {
            var path = schema.paths[name];
            if (path.$isMongooseDocumentArray) {
                setGrantSchema(path.schema);
            } else {
                var opt = schema.paths[name].options;
                if (schema.paths[name].schema) {
                    opt = schema.paths[name].schema.options;
                }
                schema.grantSchema[name] = getGrantsFromOptions(name, opt);
            }
        }
    }

    var isAllowed = function (requested_grants, grants) {
        for (var n = 0; n < grants.length; n++) {
            if (requested_grants.indexOf(grants[n]) >= 0) {
                return true;
            }
        }
        return false;
    };

    var checkSchema = function (schema, obj, grants) {
        var output = {},
            requested_grants;

        if (schema.options.id_grants) {
            requested_grants = (schema.options.id_grants) ? schema.options.id_grants: null;
            if (requested_grants && !util.isArray(requested_grants)) {
                requested_grants = [requested_grants];
            }
            if (requested_grants && isAllowed(requested_grants, grants)) {
                if (schema.options.id_output) {
                    output[schema.options.id_output] = obj._id;
                } else {
                    output._id = obj._id;
                }
            }
        }

        for (var name in schema.paths) {
            var path = schema.paths[name];
            if (schema.grantSchema[name]) {
                requested_grants = schema.grantSchema[name];

                if (requested_grants && isAllowed(requested_grants, grants)) {
                    var value = dot.pick(name, obj);
                    dot.str(name, value, output);
                }
            } else if (path.$isMongooseDocumentArray) {
                if (path.schema.options.grants && isAllowed(path.schema.options.grants, grants)) {
                    var value = dot.pick(name, obj);
                    if (util.isArray(value)) {
                        let arr = [];
                        for (var i = 0; i < value.length; i++) {
                            let v = value[i];
                            arr.push(checkSchema(path.schema, v, grants));
                        }
                        dot.str(name, arr, output);
                    }
                }
            }
        }
        return output;
    };

    setGrantSchema(schema);

    schema.setGrantsSchema = function (grantsSchema) {
        schema.grantSchema = extend(schema.grantSchema, grantsSchema);
    };

    schema.setFieldGrants = function (fieldName, grants) {
        schema.grantSchema[fieldName] = grants;
    };

    schema.getFieldGrants = function (fieldName) {
        return (schema.grantSchema[fieldName]) || null;
    };

    schema.static('format', function (entity, grants) {

        if (!grants || !util.isArray(grants))
            grants = [];

        grants.push("public");

        return checkSchema(schema, extend({}, entity.toObject()), grants);
    });

    schema.methods.format = function (grants) {
        return schema.statics.format.call(this, this, grants);
    };
};

module.exports = format_fields_plugin;
