var formatFieldsPlugin = function (schema) {
  var getTagsFromOptions = function (name, options) {
    var requestedTags
    if (options.tags) {
      requestedTags = options.tags
    } else if (options.grants) {
      requestedTags = options.grants
    } else if (options.type && options.type[0] && options.type[0].grants) {
      requestedTags = options.type[0].grants
    } else if (options.type && options.type[0] && options.type[0].tags) {
      requestedTags = options.type[0].tags
    } else {
      requestedTags = null
    }

    if (requestedTags && !Array.isArray(requestedTags)) {
      requestedTags = [requestedTags]
    }

    return requestedTags
  }

  var isAllowed = function (requestedTags, tags) {
    for (var n = 0; n < tags.length; n++) {
      if (requestedTags.indexOf(tags[n]) >= 0) {
        return true
      }
    }
    return false
  }

  var manageObject = function (obj, tags, prefix, returnAlways) {
    var output = {}
    var type
    for (var name in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, name)) {
        if (name === '_id') {
          type = 'id'
        } else if (obj[name] && obj[name].constructor.name === 'ObjectID') {
          type = 'other'
        } else if (Object.prototype.toString.call(obj[name]) === '[object Array]') {
          type = 'array'
        } else if (Object.prototype.toString.call(obj[name]) === '[object Object]') {
          type = 'object'
        } else {
          type = 'other'
        }

        var fieldName = (prefix) ? prefix + name : name
        var value = getValueByType(fieldName, obj[name], type, tags)

        if (value !== undefined) {
          var outputName = schema.output_schema[fieldName] || name
          output[outputName] = value
        }
      }
    }
    if (returnAlways) {
      return output
    } else {
      if (Object.keys(output).length > 0) {
        return output
      }
      return undefined
    }
  }

  var getValueByType = function (fieldName, value, type, tags) {
    var tagsSchema
    switch (type) {
      case 'array': {
        tagsSchema = schema.tags_schema[fieldName]
        if (tagsSchema && tagsSchema.tags && isAllowed(tagsSchema.tags, tags)) {
          if (value[0] && value[0].constructor && value[0].constructor.name === 'ObjectID') {
            return value
          } else if (Object.prototype.toString.call(value[0]) === '[object Object]') {
            var array = []
            for (var i = 0; i < value.length; i++) {
              array.push(manageObject(value[i], tags, fieldName + '.$.', true))
            }
            return array
          } else {
            return value
          }
        } else {
          return undefined
        }
      }
      case 'object': {
        tagsSchema = schema.tags_schema[fieldName]
        if (tagsSchema && tagsSchema.instance === 'Mixed') {
          if (tagsSchema.tags && isAllowed(tagsSchema.tags, tags)) {
            return value
          } else {
            return undefined
          }
        } else {
          return manageObject(value, tags, fieldName + '.')
        }
      }
      default: {
        tagsSchema = schema.tags_schema[fieldName]
        if (tagsSchema && tagsSchema.tags && isAllowed(tagsSchema.tags, tags)) {
          return value
        } else {
          return undefined
        }
      }
    }
  }

  var getTagsFromSchema = function (schema) {
    var tagsSchema = {}
    for (var name in schema.paths) {
      var field = schema.paths[name]
      if ((field.instance === 'Array' || field.instance === 'Embedded') && field.schema) {
        if (field.schema.options.grants || field.schema.options.tags) {
          tagsSchema[name] = {
            tags: getTagsFromOptions(name, field.schema.options),
            instance: field.instance
          }
        }
        var subTagsSchema = getTagsFromSchema(field.schema)
        for (var subName in subTagsSchema) {
          var sep = (field.instance === 'Embedded') ? '.' : '.$.'
          tagsSchema[name + sep + subName] = subTagsSchema[subName]
        }
      } else {
        var opt = field.options
        if (name === '_id') {
          opt.tags = (schema.options.id_grants) ? schema.options.id_grants : schema.options.id_tags
        }
        tagsSchema[name] = {
          tags: getTagsFromOptions(name, opt),
          instance: field.instance
        }
      }
    }
    return tagsSchema
  }

  var getOutputFromSchema = function (schema) {
    var outputSchema = {}
    for (var name in schema.paths) {
      var field = schema.paths[name]
      if ((field.instance === 'Array' || field.instance === 'Embedded') && field.schema) {
        var subOutputSchema = getOutputFromSchema(field.schema)
        for (var subName in subOutputSchema) {
          var sep = (field.instance === 'Embedded') ? '.' : '.$.'
          outputSchema[name + sep + subName] = subOutputSchema[subName]
        }
      } else {
        var opt = field.options
        if (name === '_id' && schema.options.id_output) {
          opt.output = schema.options.id_output
        }
        outputSchema[name] = opt.output || name.substr(name.lastIndexOf('.') + 1)
      }
    }
    return outputSchema
  }

  schema.tags_schema = getTagsFromSchema(schema)
  schema.output_schema = getOutputFromSchema(schema)

  // deprecated
  schema.setGrantsSchema = function (grantsSchema) {
    return schema.addTagsSchema(grantsSchema)
  }

  // deprecated
  schema.setFieldGrants = function (fieldName, grants) {
    return schema.setFieldTags(fieldName, grants)
  }

  // deprecated
  schema.getFieldGrants = function (fieldName) {
    return schema.tags_schema[fieldName]
  }

  schema.addTagsSchema = function (tagsSchema) {
    for (var name in tagsSchema) {
      if (Object.prototype.hasOwnProperty.call(tagsSchema, name)) {
        const v = tagsSchema[name]
        if (!schema.tags_schema[name]) {
          schema.tags_schema[name] = {
            tags: []
          }
        }
        schema.tags_schema[name].tags = v
      }
    }
    return schema
  }

  schema.setFieldTags = function (fieldName, tags) {
    if (!schema.tags_schema[fieldName]) {
      schema.tags_schema[fieldName] = {
        tags: []
      }
    }
    schema.tags_schema[fieldName].tags = tags
    return schema
  }

  schema.getFieldTags = function (fieldName) {
    return schema.tags_schema[fieldName]
  }

  schema.addOutputSchema = function (outputSchema) {
    Object.assign(schema.output_schema, outputSchema)
    return schema
  }

  schema.setFieldOutput = function (fieldName, output) {
    schema.output_schema[fieldName] = output
    return schema
  }

  schema.static('format', function (entity, tags) {
    if (!tags || !Array.isArray(tags)) { tags = [] }

    tags.push('public')

    var obj = Object.assign({}, entity.toObject())
    return manageObject(obj, tags)
  })

  schema.methods.format = function (tags) {
    return schema.statics.format.call(this, this, tags)
  }
}

module.exports = formatFieldsPlugin
