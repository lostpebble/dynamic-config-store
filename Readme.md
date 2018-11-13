## dynamic-config-store

A configuration utility for global configurations.

An example simple config:

```typescript
const config = new ConfigClass({
  accessCode: "123abc",
  nullThing: null,
  SomeLibrary: {
    Deeper: {
      key: "asdasd",
      otherKey: "123123",
    }
  },
  wins: 213,
});
```

A configuration can be easily defined through the following means (higher takes precedence over others):

* Environment Overrides (every single config value has the ability to be overridden through environment variables)
  * e.g. `CONFIG_OVERRIDE_SERVER__PORT`
* Defined Environment Links (these are nicer, pre-defined environment overrides)

These configurations can also have reactions added into them to form extra
config values based off of any changes that may happen to the config.