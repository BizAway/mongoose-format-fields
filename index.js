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

  var manageObject = function (entity, obj, tags, prefix, returnAlways) {
    var output = {}
    for (var [name, field] of Object.entries(obj)) {
      var fieldName = (prefix) ? prefix + name : name
      var isVirtual = isVirtualField(entity, fieldName)

      var type
      var value
      if (name === '_id') {
        type = 'id'
      } else if (field && field.constructor.name === 'ObjectID') {
        type = 'other'
      } else if (Object.prototype.toString.call(field) === '[object Array]') {
        type = 'array'
      } else if (Object.prototype.toString.call(field) === '[object Object]') {
        type = 'object'
      } else {
        type = 'other'
      }

      if (isVirtual) {
        var virtualEntity = entity.get(fieldName)
        if (virtualEntity) {
          if (type === 'array') {
            output[name] = []
            for (var [idx, item] of virtualEntity.entries()) {
              output[name].push(manageObject(item, field[idx], tags))
            }
          } else {
            output[name] = manageObject(virtualEntity, field, tags)
          }
        }
      } else {
        value = getValueByType(entity, fieldName, field, type, tags)
        if (value !== undefined) {
          var outputName = entity.schema.output_schema[fieldName] || name
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

  var getValueByType = function (entity, fieldName, value, type, tags) {
    var tagsSchema
    switch (type) {
      case 'array': {
        tagsSchema = entity.schema.tags_schema[fieldName]
        if (tagsSchema && tagsSchema.tags && isAllowed(tagsSchema.tags, tags)) {
          if (value[0] && value[0].constructor && value[0].constructor.name === 'ObjectID') {
            return value
          } else if (Object.prototype.toString.call(value[0]) === '[object Object]') {
            var array = []
            for (var [idx, item] of Object.entries(value)) {
              var entityObj = entity.get(fieldName)[idx]
              if (entityObj.schema && entityObj.schema.virtuals && Object.keys(entityObj.schema.virtuals).length > 1) {
                array.push(manageObject(entityObj, item, tags))
              } else {
                array.push(manageObject(entity, item, tags, fieldName + '.$.', true))
              }
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
        tagsSchema = entity.schema.tags_schema[fieldName]
        if (tagsSchema && tagsSchema.instance === 'Mixed') {
          if (tagsSchema.tags && isAllowed(tagsSchema.tags, tags)) {
            return value
          } else {
            return undefined
          }
        } else {
          return manageObject(entity, value, tags, fieldName + '.')
        }
      }
      default: {
        tagsSchema = entity.schema.tags_schema[fieldName]
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
    for (var [name, field] of Object.entries(schema.paths)) {
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
    for (var [name, field] of Object.entries(schema.paths)) {
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

  var isVirtualField = function (entity, path) {
    if (path === 'id') {
      return false
    }
    for (var virtualField of Object.values(entity.schema.virtuals)) {
      if (virtualField.path === path) {
        return true
      }
    }
    return false
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

  schema.static('format', function (entity, tags, opts) {
    var optsDefaults = { virtuals: false }

    if (opts && typeof opts.virtuals !== 'undefined') {
      optsDefaults.virtuals = opts.virtuals
    }

    if (!tags || !Array.isArray(tags)) { tags = [] }

    tags.push('public')
    var objEntity = entity.toObject({ virtuals: optsDefaults.virtuals })
    var obj = manageObject(entity, objEntity, tags)
    return obj
  })

  schema.methods.format = function (tags, opts) {
    return schema.statics.format.call(this, this, tags, opts)
  }
}

module.exports = formatFieldsPlugin
