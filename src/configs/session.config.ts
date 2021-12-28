import cassandraDriver from 'cassandra-driver'
import cassandraStore from 'cassandra-store'
import expressSession from 'express-session'
import { logInfo } from 'src/utils/logger'
import { CONSTANTS } from '../utils/env'

let sessionConfig: expressSession.SessionOptions

const cassandraClientOptions: cassandraDriver.ClientOptions = {
  contactPoints: getIPList(),
  keyspace: 'portal',
  queryOptions: {
    prepare: true,
  },
}

function getIPList() {
  return CONSTANTS.CASSANDRA_IP.split(',')
}

if (
  CONSTANTS.IS_CASSANDRA_AUTH_ENABLED &&
  CONSTANTS.CASSANDRA_USERNAME &&
  CONSTANTS.CASSANDRA_PASSWORD
) {
  cassandraClientOptions.authProvider = new cassandraDriver.auth.PlainTextAuthProvider(
    CONSTANTS.CASSANDRA_USERNAME,
    CONSTANTS.CASSANDRA_PASSWORD
  )
}

export function getSessionConfig(
  isPersistant = true
): expressSession.SessionOptions {
  if (!sessionConfig) {
    sessionConfig = {
      cookie: {
        maxAge: CONSTANTS.KEYCLOAK_SESSION_TTL,
      },
      resave: false,
      saveUninitialized: false,
      secret: '927yen45-i8j6-78uj-y8j6g9rf56hu',
      store: isPersistant
        ? new cassandraStore({
          client: null,
          clientOptions: cassandraClientOptions,
          table: 'sessions',
        })
        : new expressSession.MemoryStore(),
    }
  }
  return sessionConfig
}

export function setSessionConfig() {
  const sessionConfiguration = getSessionConfig()
  logInfo("sessionConfiguration : ", sessionConfiguration)
  return expressSession(sessionConfiguration)
}
