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
  instance: {
    port: 8000,
    host: {
      protocol: "http",
      hostname: "localhost",
    },
  },
});
```

This creates our initial configuration, with **well-defined defaults**.

Getting config values at a later stage, is easy:

```
const { isProductionEnv } = config.getConfig();
```

As usefulness goes, this isn't giving us much at the moment. Let's look at some ways `dynamic-config-store` expands on the
customization of your configs:

### 🔌 Environment Links

#### Pre-defined environment overrides for your config

Let's try one now:

```typescript
config.setEnvLinks({
  isProductionEnv: {
    env: "NODE_ENV",
    type: ETypeOfEnvLink.FUNCTION,
    func: v => v === "production",
  },
});
```

We now have a nice global, _boolean_, configuration value for `isProductionEnv` which we can call upon.
   No more ugly checks for `process.env.NODE_ENV === "production"` all over the place.

Look at the `type` here. We passed a `FUNCTION` type, which means that whatever we read from the environment
   variables will be passed through a function, which we have defined here in `func`, and the returned value
   will become `isProductionEnv`.

By default, this link is `required` - as in, if we don't find `process.env.NODE_ENV`, the config will throw an error.

Let's look at some more:

```typescript
config.setEnvLinks({
  instance: {
    port: {
      env: "SERVER_PORT",
      type: ETypeOfEnvLink.NUMBER,
      required: false
    },
    host: {
      hostname: {
        env: "SERVER_HOST_NAME",
        type: ETypeOfEnvLink.STRING,
        defaultValue: "example.com",
        required: false
      }
    }
  },
});
```

Here we define two more environment links. You can define as many and deeply in the config
"tree" as you would like. For the sake of example we have run `setEnvLinks()` twice now, but
you can combine all your links in one go.

You can see on the second link here, we set a `defaultValue` - this will take precedence over
the initial default value we set at the beginning, on defining the config.

Lastly, look at the `type` that has been set for both. `NUMBER` and `STRING` respectively. Let's go
into more detail on those:

#### Environment Link Types

Environment variables are always of `string` type, but sometimes we don't always want strings.
`dynamice-config-store` provides you with alternative ways to interpret values from the environment:

- `STRING` - The value will be returned as is from the environment variable
- `NUMBER` - The value will be converted and set as a number on your config property
- `JSON_STRING` - The value will be put through `JSON.parse()`, this assumes that the
  environment value is a serialized JSON string. The config takes care of converting serialized JavaScript dates
  back to proper `Date` objects too.
- `FUNCTION` - Allows you to define a function under the `func` property, which will simply be passed
  the value from the environment - and must return the final value you'd like in your config.

### ⚠ Environment Overrides

Every config value has the ability to be overridden through environment variables, **_even if no link exists_**

Mostly used for quick fixes or debugging scenarios, when a full re-build and deployment is not desired.

In our above config, we kept it simple for the sake of example. But we really should have added a little more
info to make it more deliberate in its identity.

We should have done something like this:

```typescript
const config = new ConfigStore<ISimpleServerConfig>({
   isProductionEnv: false,
   serverSecret: "123abc",
   instance: {
     port: 8080,
     host: {
       protocol: "http",
       hostname: "localhost",
     },
   },
 }, "CONFIG_SERVER_OVERRIDE_", "Server Config");
```

Those two second parameters here identify this configuration much better. And especially for the sake of
Environment Overrides, the first one helps us target this specific config - like so:

```typescript
{
 isProductionEnv: false,    // CONFIG_SERVER_OVERRIDE_IS_PRODUCTION_ENV
 serverSecret: "123abc",    // CONFIG_SERVER_OVERRIDE_SERVER_SECRET
 instance: {
   port: 8080,              // CONFIG_SERVER_OVERRIDE_INSTANCE__PORT
   host: {
     protocol: "http",      // CONFIG_SERVER_OVERRIDE_INSTANCE__PORT__PROTOCOL
     hostname: "localhost", // CONFIG_SERVER_OVERRIDE_INSTANCE__PORT__HOSTNAME
   },
 },
}
```

If any of those override environment variables have been set, they will take precedence over any other value
set for the config.

Any value set in these overrides shall be put through `JSON.parse()`, allowing for the reviving of proper
JavaScript types - including `Date` objects. So keep that in mind, because of the following cases:

```
CONFIG_SERVER_OVERRIDE_IS_PRODUCTION_ENV:   true          // fine - can parse directly to boolean
CONFIG_SERVER_OVERRIDE_SERVER_SECRET:       123abc        // ERROR - not JSON parsable
CONFIG_SERVER_OVERRIDE_SERVER_SECRET:       "123abc"      // 50 / 50 - will fail if the quotations aren't escaped
CONFIG_SERVER_OVERRIDE_SERVER_SECRET:       \"123abc\"    // probably safest for string types
CONFIG_SERVER_OVERRIDE_INSTANCE__PORT:      4000          // fine - can parse directly to number
```

Basically this allows you to create great global configs for your deployments without thinking straight away
about what you'd like to expose as an environment variable. If you find that later you are using an override
constantly to set a certain config value - then its probably time to create a dedicated and well-named link.

### Ignoring Environment Overrides

If for whatever reason (possibly security concerns) you don't want to allow an override for a certain value - all
you have to do to ignore the override is get your config like so:

```
const { serverSecret } = ServerConfig.getConfig({ ignoreOverrides: true });
```

### Deep Merging and Extending

All of the methods in `dynamic-config-store` use **deep merging** when changing the config. This
ensures that your objects deeper in the config tree are not wholly over-written or cleared when you
simply want to change a single value within one.

This is useful for when you are extending an external configuration, from perhaps a library or one of your own
internal packages that you use in different projects for code re-use. For example, if you were extending this
Server Config from the example in a project you might do something like:

```typescript
import { ServerConfig } from "server-utility/ServerConfig";

ServerConfig.setConfig({
   serverSecret: "my-new-secret",
   instance: {
     port: 3000,
   },
});
```

This would set a new `serverSecret` default, and would only replace the `port` value inside of `instance`, and keep all the original defaults set by the
original config during creation, here in a library apparently called `server-utility`. You could even now define
your own **Environment Links** into this external configuration, specific to this deployment:

```typescript
ServerConfig.setEnvLinks({
  serverSecret: {
    env: "MY_SERVER_SECRET",
    type: ETypeOfEnvLink.STRING
  },
}, true);   // Setting true here will wipe out all the Links set previously!
            // In this case, SERVER_PORT, SERVER_HOST_NAME and NODE_ENV
            // default is false - as this is most often not desired
```

Modularity and extensibility are first class citizens in `dynamic-config-store`!

## Best practice

You should always define your configuration before any other code runs. Let's look at a simple example of
a config for a server deployment:

Create an entry file and import the config file first, this initializes it before any other code:

```typescript
// project/src/entry.ts
import "./ServerConfig";
import "./Server";
```

```typescript
// project/src/ServerConfig.ts
import { ConfigStore } from "dynamic-config-store";

export const ServerConfig = new ConfigStore<ISimpleServerConfig>({
   isProductionEnv: false,
   serverSecret: "123abc",
   instance: {
     port: 8080,
     host: {
       protocol: "http",
       hostname: "localhost",
     },
   },
 }, "CONFIG_SERVER_OVERRIDE_", "Server Config");
```

That potential Server file:

```typescript
// project/src/Server.ts
import { ServerConfig } from "./ServerConfig";
import Koa from "koa";

const { serverSecret, isProductionEnv, instance: { port, host: { protocol, hostname }} } = ServerConfig.getConfig();

const app = new Koa();

app.keys([serverSecret]);

// ... app configuration ...

app.listen(port, () => {
  if (!isProductionEnv) {
    console.info(`Server is not running as production!`);
  }
  
  console.info(`listening on ${protocol}://${hostname}:${port}`);
});
```
