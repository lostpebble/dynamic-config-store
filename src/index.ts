import immer from "immer";
import { snakeCase } from "lodash";
import { merge } from "lodash";

const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isString(value: any) {
  return {}.toString.call(value) === "[object String]";
}

function isSerializedDate(value: string) {
  return isString(value) && value.length > 15 && value.length < 30 && datePattern.test(value);
}

function reviveDateObjects(key: string, value: string) {
  if (isSerializedDate(value)) {
    return new Date(value);
  }

  return value;
}

interface IObject {
  [prop: string]: any;
}

function getOverridesFromEnv<T extends IObject>(prefix: string, obj: T): T {
  const overrideObj: IObject = {};

  for (const key of Object.keys(obj)) {
    const overrideKey = `${prefix}${snakeCase(key).toUpperCase()}`;

    if (obj[key] != null && typeof obj[key] === "object") {
      overrideObj[key] = getOverridesFromEnv(`${overrideKey}__`, obj[key]);
    } else {
      if (typeof process.env[overrideKey] !== "undefined" && process.env[overrideKey] != null) {
        overrideObj[key] = JSON.parse(process.env[overrideKey]!, reviveDateObjects);
      }
    }
  }

  return overrideObj as T;
}

export enum ETypeOfEnvLink {
  STRING = "STRING",
  NUMBER = "NUMBER",
  JSON_STRING = "JSON_STRING",
  FUNCTION = "FUNCTION",
}

export type TEnvironmentLink =
  | {
      env: string;
      type: ETypeOfEnvLink.JSON_STRING;
      func?: null;
      required?: boolean;
      defaultValue?: any;
    }
  | {
      env: string;
      type: ETypeOfEnvLink.FUNCTION;
      func: (value: any) => any;
      required?: boolean;
      defaultValue?: any;
    }
  | {
      env: string;
      type: ETypeOfEnvLink.NUMBER;
      func?: null;
      required?: boolean;
      defaultValue?: number;
    }
  | {
      env: string;
      type: ETypeOfEnvLink.STRING;
      func?: null;
      required?: boolean;
      defaultValue?: string;
    };

type DeepPartial<T, F = undefined> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : F extends undefined ? T[P] : F
};
export type TEnvironmentLinks<T extends IObject> = {
  [property in keyof Partial<T>]: T[property] extends object
    ? TEnvironmentLinks<T[property]>
    : TEnvironmentLink
};

const envLinkOptionalProps = ["defaultValue", "required", "func"];

function isEnvLink(obj: any): obj is TEnvironmentLink {
  if (!obj.hasOwnProperty("env")) {
    return false;
  }
  if (!obj.hasOwnProperty("type")) {
    return false;
  }

  const extraPropsAmount = Object.keys(obj).length - 2;
  const hasOptionalKeys = envLinkOptionalProps.filter(prop => obj.hasOwnProperty(prop));
  return extraPropsAmount === hasOptionalKeys.length;
}

function getEnvLinksFromEnv<T extends IObject>(
  envLinks: TEnvironmentLinks<T>,
  configName: string,
  values: T,
  prefixKey: string = ""
): T {
  const envLinksObj: IObject = {};

  const configNameString = configName.length > 0 ? ` (${configName})` : "";

  for (const key of Object.keys(envLinks)) {
    const cur: TEnvironmentLink | TEnvironmentLinks<any> = envLinks[key];

    if (isEnvLink(cur)) {
      const { type, env, required = true, func }: TEnvironmentLink = cur;

      if (typeof process.env[env] === "undefined") {
        if (required) {
          throw new Error(
            `CONFIG${configNameString}: property '${prefixKey}${key}', Couldn't get the REQUIRED environment variable [${env}] - you must define it. (alternatively set the link to not-required and provide a default)`
          );
        }

        /*if (typeof defaultValue === "undefined") {
          throw new Error(
            `CONFIG${configNameString}: default value for pulling environment variable [${env}] is undefined (an environment variable that is not required must have a default value)`
          );
        }*/
        let def;

        if (cur.hasOwnProperty("defaultValue")) {
          envLinksObj[key] = cur.defaultValue;
          def = cur.defaultValue;
          console.warn(
            `CONFIG${configNameString}: property '${prefixKey}${key}' using default value (${JSON.stringify(
              def
            )}) because env variable "${env}" was not set.`
          );
        } else {
          def = values[key];
          console.warn(
            `CONFIG${configNameString}: property '${prefixKey}${key}' couldn't be set from env variable "${env}" (was not present) - so not changing its value from what was set before (${def}).`
          );
        }
      } else {
        const envString: string = process.env[env]!;
        let value;

        if (type === ETypeOfEnvLink.JSON_STRING) {
          value = JSON.parse(envString, reviveDateObjects);
        } else if (type === ETypeOfEnvLink.NUMBER) {
          value = Number(envString);
        } else if (type === ETypeOfEnvLink.FUNCTION) {
          if (func != null) {
            value = func(envString);
          } else {
            throw new Error(
              `CONFIG${configNameString}: type of environment link for ${key} [${env}] is of FUNCTION type, but no function has been defined. Check your envLink config.`
            );
          }
        } else {
          value = envString;
        }

        envLinksObj[key] = value;
      }
    } else {
      const deeper = getEnvLinksFromEnv(cur, configName, values[key], `${prefixKey}${key}.`);

      if (Object.keys(deeper).length > 0) {
        envLinksObj[key] = getEnvLinksFromEnv(cur, configName, values[key], `${prefixKey}${key}.`);
      }
    }
  }

  return envLinksObj as T;
}

export type TConfigChangeReaction<T = any> = (config: T) => void;

export class ConfigStore<T extends IObject> {
  private _values: T;
  private _valuesWithAugmentations!: T;
  private _overridePrefix!: string;
  private readonly _configName: string;
  private _envOverrides: Partial<T> = {};
  private _envLinks: Partial<T> = {};
  private _configChangeReactions: Array<TConfigChangeReaction<any>> = [];

  constructor(initialValues: T, envOverridePrefix: string = "CONFIG_OVERRIDE_", configName = "") {
    this._configName = configName;
    this._values = initialValues;
    this.setEnvOverridePrefix(envOverridePrefix);
  }

  setEnvOverridePrefix(envOverridePrefix: string) {
    this._overridePrefix = envOverridePrefix;
    try {
      this._envOverrides = getOverridesFromEnv(envOverridePrefix, this._values);
    } catch (e) {
      console.error(
        `Your configuration overrides ( prefix: ${envOverridePrefix} ) need to be JSON parsable - you need to escape string double quotes \\"`
      );
      throw e;
    }

    this.finalizeValues();
  }

  setEnvLinks(envLinks: TEnvironmentLinks<T>, ignorePrevious = false) {
    if (ignorePrevious) {
      this._envLinks = {};
    }

    this._envLinks = merge({}, this._envLinks, getEnvLinksFromEnv(envLinks, this._configName, this._values));
    this.finalizeValues();
  }

  addConfigChangeReaction(configChangeReaction: TConfigChangeReaction<T>) {
    this._configChangeReactions.push(configChangeReaction);
    this.finalizeValues();
  }

  setConfig(config: DeepPartial<T>, envOverridePrefix = this._overridePrefix) {
    this._values = merge({}, this._values, config);
    this.setEnvOverridePrefix(envOverridePrefix);

    console.log(`Should have set values`, config);
  }

  getConfig({
    ignoreOverrides = false,
    ignoreEnvLinks = false,
    ignoreReactions = false,
  }: {
    ignoreOverrides?: boolean;
    ignoreEnvLinks?: boolean;
    ignoreReactions?: boolean;
  } = {}): T {
    if (ignoreOverrides || ignoreEnvLinks || ignoreReactions) {
      let returnValues: T = merge({}, this._values);

      if (!ignoreEnvLinks) {
        returnValues = merge(returnValues, this._envLinks);
      }

      if (!ignoreOverrides) {
        returnValues = merge(returnValues, this._envOverrides);
      }

      if (!ignoreReactions) {
        for (const changeReaction of this._configChangeReactions) {
          returnValues = immer(returnValues, changeReaction);
        }
      }

      return returnValues;
    }

    return this._valuesWithAugmentations;
  }

  getEnvLinks(): Partial<T> {
    return this._envLinks;
  }

  getOverrides(): Partial<T> {
    return this._envOverrides;
  }

  private finalizeValues() {
    this._valuesWithAugmentations = merge({}, this._values, this._envLinks, this._envOverrides);

    for (const changeReaction of this._configChangeReactions) {
      this._valuesWithAugmentations = immer(this._valuesWithAugmentations, changeReaction);
    }
  }
}

export const __jest_test_internals = {
  isEnvLink,
};
