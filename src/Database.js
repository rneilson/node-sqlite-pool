/**
 * SQLite client library for Node.js applications
 *
 * Copyright © 2016 Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Statement from './Statement';
import { isThenable } from './utils';

class Database {

  /**
   * Initializes a new instance of the database client.
   * @param driver An instance of SQLite3 driver library.
   * @param promiseLibrary ES6 Promise library to use.
     */
  constructor (driver, { Promise, trxImmediate }) {
    this.driver = driver;
    this.Promise = Promise;
    this.trxImmediate = trxImmediate;
  }

  run (sql, ...params) {
    const Promise = this.Promise;

    if (params.length === 1) {
      params = params[0];
    }

    return new Promise((resolve, reject) => {
      this.driver.run(sql, params, function runExecResult(err) {
        if (err) {
          reject(err);
        }
        else {
          // Per https://github.com/mapbox/node-sqlite3/wiki/API#databaserunsql-param--callback
          // when run() succeeds, the `this' object is a driver statement object. Wrap it as a
          // Statement.
          resolve(new Statement(this, Promise));
        }
      });
    });
  }

  get (sql, ...params) {
    if (params.length === 1) {
      params = params[0];
    }

    return new this.Promise((resolve, reject) => {
      this.driver.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(row);
        }
      });
    });
  }

  all (sql, ...params) {
    if (params.length === 1) {
      params = params[0];
    }

    return new this.Promise((resolve, reject) => {
      this.driver.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Runs all the SQL queries in the supplied string. No result rows are retrieved.
   */
  exec (sql) {
    return new this.Promise((resolve, reject) => {
      this.driver.exec(sql, (err) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(this);
        }
      });
    });
  }

  each (sql, ...params) {
    const callback = params.pop();
    if (params.length === 1) {
      params = params[0];
    }

    return new this.Promise((resolve, reject) => {
      this.driver.each(sql, params, callback, (err, rowsCount = 0) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(rowsCount);
        }
      });
    });
  }

  prepare (sql, ...params) {
    if (params.length === 1) {
      params = params[0];
    }

    return new this.Promise((resolve, reject) => {
      const stmt = this.driver.prepare(sql, params, (err) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(new Statement(stmt, this.Promise));
        }
      });
    });
  }

  wait () {
    return new this.Promise((resolve, reject) => {
      this.driver.wait((err) => {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  async transaction (fn, immediate = this.trxImmediate) {
    // Begin transaction
    if (immediate) {
      await this.exec('BEGIN IMMEDIATE');
    }
    else {
      await this.exec('BEGIN');
    }

    let result;
    try {
      // Pass connection to function
      result = fn(this);

      // If function didn't return a thenable, wait
      if (isThenable(result)) {
        await result;
      }
      else {
        await this.wait();
      }

      // Commit
      await this.exec('COMMIT');
    }
    catch (err) {
      // Roll back, release connection, and re-throw
      await this.exec('ROLLBACK');
      throw err;
    }

    return result;
  }

}

export default Database;
