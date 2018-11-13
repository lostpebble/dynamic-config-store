## 🔱 Dynamic Config Store

A utility for configurations which can be dynamically changed from various sources.

```
yarn add dynamic-config-store
```

The library has been built from the ground up in Typescript, so its recommended (though not required)
to use it to get some great auto-completion suggestions for your configs.

## Quick Start

Let's create a basic server configuration:

```typescript
import { ConfigStore } from "dynamic-config-store";

// Can pass a TypeScript interface to the constructor
// for all the goodness that comes with that

const config = new ConfigStore<ISimpleServerConfig>({
  isProductionEnv: false,
  serverSecret: "123abc",
  serverConfig: {
    port: 8000,
    host: {
      protocol: "http",
      hostname: "localhost",
    }
  }
});
```

This creates our initial configuration, with well-defined defaults.

A configuration can be easily dynamically changed via the following means:

### Defined Environment Links
#### Nice, pre-defined environment overrides for your config

Let's try some now:

```
config.setEnvLinks({
  isProductionEnv: {
    env: "NODE_ENV",
    type: ETypeOfEnvLink.FUNCTION,
    func: v => v === "production",
  },
  serverConfig: {
    port: {
      env: "SERVER_PORT",
      type: ETypeOfEnvLink.NUMBER,
      required: false
    },
  },
});
```

1. We now have a nice global, _boolean_, configuration value for `isProductionEnv` which we can call upon.
No more ugly checks for `process.env.NODE_ENV === "production"` all over the place.

2. Look at how we defined the second environment link, with a deep assignment matching
directly to the structure of our config. This allows us to use environment variables to define values as deep
in the config "tree" as we'd like!

3. Lastly, look at number **1** again and **2** again, specifically at the `type` that has been set. 
`FUNCTION` and `NUMBER` respectively. We can set one of a few types in that position:

#### Environment Override Types

Environment variables are always of String type, but sometimes we don't always want strings.
`dynamice-config-store` provides you with alternative ways to interpret values from the environment:

   * `STRING` - The value will be returned as is from the environment variable
   * `NUMBER` - The value will be converted and set as a number on your config property
   * `JSON_STRING` - The value will be put through `JSON.parse()`, this assumes that the
   environment value is a serialized JSON string. The config takes care of converting serialized JavaScript dates
   back to proper `Date` objects too.
   * `FUNCTION` - Allows you to define a function under the `func` property, which will simply be passed
   the value from the environment - and must return the final value you'd like in your config.

### Environment Overrides

#### (every single config value has the ability to be overridden through environment variables)

e.g. `CONFIG_OVERRIDE_SERVER__PORT`

These configurations can also have reactions added into them to form extra
config values based off of any changes that may happen to the config.