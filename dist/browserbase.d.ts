import EventDispatcher from './event-dispatcher.d.ts';

interface StoresDefinitions {
  [storeName: string]: string;
}

type IDBTransactionMode = 'readonly' | 'readwrite' | 'versionchange';
type CursorIterator = (cursor: IDBCursor, transaction: IDBTransaction) => false | any;

/**
 * A nice promise-based syntax on indexedDB also providing events when open, closed, and whenever data is changed.
 * Dispatches the change events even when the change did not originate in this browser tab.
 *
 * Versioning is simplified. You provide a string of new indexes for each new version, with the first being the primary
 * key. For primary keys, use a "++" prefix to indicate auto-increment, leave it empty if the key isn't part of the
 * object. For indexes, use a "-" index to delete a defined index, use "&" to indicate a unique index, use "*" for a
 * multiEntry index, and use "[field + anotherField]" for compound indexes. Examples:
 *
 * // Initial version, should remain the same with updates
 * db.version(1, {
 *   friends: 'fullName, age'
 * });
 *
 * // Next version, we don't add any indexes, but we want to run our own update code to prepopulate the database
 * db.version(2, {}, function(oldVersion, transaction) {
 *   // prepopulate with some initial data
 *   transaction.objectStore('friends').put({ fullName: 'Tom' });
 * });
 *
 * // Remove the age index and add one for birthdate, add another object store with an auto-incrementing primary key
 * // that isn't part of the object, and a multiEntry index on the labels array.
 * db.version(3, {
 *   friends: 'birthdate, -age, [lastName + firstName]',
 *   events: '++, date, *labels'
 * });
 *
 *
 * After the database is opened, a property will be added to the database instance for each object store in the
 * database. This is how you will work with the data in the database. For e.g.
 *
 * db.version(1, { foo: 'id' });
 *
 * // Will be triggered once for any add, put, or delete done in any browser tab. The object will be null when it was
 * // deleted, so use the key when object is null.
 * db.on('change', (object, key) => {
 *   console.log('Object with key', key, 'was', object === null ? 'deleted' : 'saved');
 * });
 *
 * db.open().then(() => {
 *   db.foo.put({ id: 'bar' }).then(() => {
 *     console.log('An object was saved to the database.');
 *   });
 * }, err => {
 *   console.warn('There was an error opening the database:', err);
 * });
 */
declare class Browserbase extends EventDispatcher {
  /**
   * Deletes a database by name.
   */
  static deleteDatabase(name: string): Promise<void>;

  [storeName: string]: ObjectStore;

  /**
   * Creates a new indexeddb database with the given name.
   */
  constructor(name: string);

  /**
   * Defines a version for the database. Additional versions may be added, but existing version should not be changed.
   */
  version(version: number, stores: StoresDefinitions, upgradeFunction: Function): this;

  /**
   * Whether this database is open or closed.
   */
  isOpen(): boolean;

  /**
   * Open a database, call this after defining versions.
   */
  open(): Promise<void>;

  /**
   * Closes the databse.
   */
  close(): void;

  /**
   * Starts a multi-store transaction. All store methods on the returned database clone will be part of this transaction
   * until the next tick or until calling db.commit().
   */
  start(storeNames: string[], mode: IDBTransactionMode = 'readwrite'): Browserbase;

  /**
   * Finishes a started transaction so that other transactions may be run. This is not needed for a transaction to run,
   * but it allows other transactions to be run in this thread. It ought to be called to avoid conflicts with other
   * code elsewhere.
   */
  commit(): Promise<void>;

  /**
   * Dispatches a change event when an object is being added, saved, or deleted. When deleted, the object will be null.
   */
  dispatchChange(store: ObjectStore, obj: any, key: any, from: 'local' | 'remote' = 'local'): void;

  /**
   * Creates or updates a store with the given indexesString. If null will delete the store.
   */
  upgradeStore(storeName: string, indexesString: string): Promise<void>;
}


/**
 * An abstraction on object stores, allowing to more easily work with them without needing to always explicitly create a
 * transaction first. Also helps with ranges and indexes and promises.
 */
class ObjectStore extends EventDispatcher {
  constructor(db: Browserbase, name: string, keyPath: string, transactionDb: Browserbase);

  /**
   * Get an object from the store by its primary key
   */
  get(key: any): Promise<any>;


  /**
   * Get all objects in this object store. To get only a range, use where()
   */
  getAll(): Promise<any[]> {
    return requestToPromise(this._transStore('readonly').getAll(), null, this.db);
  }

  /**
   * Gets the count of all objects in this store
   */
  count(): Promise<number> {
    return requestToPromise(this._transStore('readonly').count(), null, this.db);
  }

  /**
   * Adds an object to the store. If an object with the given key already exists, it will not overwrite it.
   */
  add(obj: any, key?: any): Promise<any>;

  /**
   * Adds an array of objects to the store in once transaction. You can also call startTransaction and use add().
   */
  addAll(array: any[]): Promise<void>;

  /**
   * Adds an array of objects to the store in once transaction. You can also call startTransaction and use add(). Alias
   * of addAll().
   */
  bulkAdd(array: any[]): Promise<void>;

  /**
   * Saves an object to the store. If an object with the given key already exists, it will overwrite it.
   */
  put(obj: any, key?: any): Promise<any>;

  /**
   * Saves an array of objects to the store in once transaction. You can also call startTransaction and use put().
   */
  putAll(array: any[]): Promise<void>;

  /**
   * Saves an array of objects to the store in once transaction. You can also call startTransaction and use put(). Alias
   * of putAll().
   */
  bulkPut(array: any[]): Promise<void>;

  /**
   * Deletes all objects from a store.
   */
  delete(key: any): Promise<void>;

  /**
   * Deletes an object from the store.
   */
  deleteAll(): Promise<void>;

  /**
   * Use to get a subset of items from the store by id or index. Returns a Where object to allow setting the range and
   * limit.
   */
  where(index: any = ''): Where;
}


/**
 * An abstraction on object stores, allowing to more easily work with them without needing to always explicitly create a
 * transaction first. Also helps with ranges and indexes and promises.
 */
class Where {
  constructor(store: ObjectStore, index: any);

  /**
   * Set greater than the value provided.
   */
  startsAfter(value: any): this;

  /**
   * Set greater than or equal to the value provided.
   */
  startsAt(value: any): this;

  /**
   * Set less than the value provided.
   */
  endsBefore(value: any): this;

  /**
   * Set less than or equal to the value provided.
   */
  endsAt(value: any): this;

  /**
   * Set the exact match, no range.
   */
  equals(value: any): this;

  /**
   * Sets the upper and lower bounds to match any string starting with this prefix.
   */
  startsWith(prefix: string): this;

  /**
   * Limit the return results to the given count.
   */
  limit(count: number): this;

  /**
   * Reverses the direction a cursor will get things.
   */
  reverse(): this;

  /**
   * Converts this Where to its IDBKeyRange equivalent.
   */
  toRange(): IDBKeyRange;

  /**
   * Get all the objects matching the range limited by the limit.
   */
  getAll(): Promise<any[]>;

  /**
   * Get all the keys matching the range limited by the limit.
   */
  getAllKeys(): Promise<any[]>;

  /**
   * Gets a single object, the first one matching the criteria
   */
  get(): Promise<any>;

  /**
   * Gets a single key, the first one matching the criteria
   */
  getKey(): Promise<any[]>;

  /**
   * Gets the count of the objects matching the criteria
   * @return {Promise} Resolves with a number
   */
  count(): Promise<number>;

  /**
   * Deletes all the objects within this range.
   */
  deleteAll(): Promise<void>;

  /**
   * Uses a cursor to efficiently iterate over the objects matching the range calling the iterator for each one.
   */
  cursor(iterator: CursorIterator, mode: IDBTransactionMode = 'readonly', keyCursor = false): Promise<void>;

  /**
   * Updates objects using a cursor to update many objects at once matching the range.
   */
  update(iterator: CursorIterator): Promise<void>;

  /**
   * Uses a cursor to efficiently iterate over the objects matching the range calling the iterator for each one.
   */
  forEach(iterator: CursorIterator, mode: IDBTransactionMode = 'readonly'): Promise<void>;

  /**
   * Uses a cursor to efficiently iterate over the objects matching the range calling the iterator for each one and
   * returning the results of the iterator in an array.
   */
  map(iterator: CursorIterator, mode = 'readonly'): Promise<any[]>;
}

export default Browserbase;
