import { BaseDocument } from "@alice-interfaces/database/BaseDocument";
import { OperationResult } from "@alice-interfaces/core/OperationResult";
import { DatabaseUtilityConstructor } from "@alice-types/database/DatabaseUtilityConstructor";
import { Manager } from "@alice-utils/base/Manager";
import { Collection as DiscordCollection } from "discord.js";
import { Collection as MongoDBCollection, FilterQuery, FindOneOptions, OptionalId, UpdateManyOptions, UpdateQuery, WithoutProjection } from "mongodb";

/**
 * A MongoDB collection manager.
 */
export abstract class DatabaseCollectionManager<T extends BaseDocument, C extends Manager> extends Manager {
    /**
     * The collection that this manager is responsible for.
     */
    protected readonly collection: MongoDBCollection<T>;

    /**
     * The constructor function of the utility of this collection.
     */
    protected abstract readonly utilityInstance: DatabaseUtilityConstructor<T, C>;

    /**
     * The default document of this collection.
     */
    abstract get defaultDocument(): T;

    /**
     * The default instance of this collection utility.
     */
    get defaultInstance(): C {
        return new this.utilityInstance(this.defaultDocument);
    }

    /**
     * @param collection The MongoDB collection.
     */
    constructor(collection: MongoDBCollection<T>) {
        super();

        this.collection = collection;
    }

    /**
     * Updates multiple documents in the collection.
     * 
     * @param filter The filter used to select the documents to update.
     * @param query The update operations to be applied to the documents.
     * @param options Options for the update operation.
     * @returns An object containing information about the operation.
     */
    update(filter: FilterQuery<T>, query: UpdateQuery<T> | Partial<T>, options: UpdateManyOptions = {}): Promise<OperationResult> {
        return new Promise(resolve => {
            this.collection.updateMany(filter, query, options, err => {
                if (err) {
                    return resolve(this.createOperationResult(false, err.message));
                }

                resolve(this.createOperationResult(true));
            });
        });
    }

    /**
     * Gets multiple documents from the collection and then
     * index them based on the given key.
     * 
     * @param key The key to index.
     * @param filter The document filter.
     * @returns The indexed documents in a discord.js collection.
     */
    async get<K extends keyof T>(key: K, filter?: FilterQuery<T>): Promise<DiscordCollection<T[K], C>>;

    /**
     * Gets multiple documents from the collection and then
     * index them based on the given key.
     * 
     * @param key The key to index.
     * @param filter The document filter.
     * @param options The options for retrieving the documents. 
     * @returns The indexed documents in a discord.js collection.
     */
    async get<K extends keyof T>(key: K, filter: FilterQuery<T>, options?: WithoutProjection<FindOneOptions<T>>): Promise<DiscordCollection<T[K], C>>;

    /**
     * Gets multiple documents from the collection and then
     * index them based on the given key.
     * 
     * @param key The key to index.
     * @param filter The document filter.
     * @param options The options for retrieving the documents. 
     * @returns The indexed documents in a discord.js collection.
     */
    async get<K extends keyof T>(key: K, filter: FilterQuery<T>, options: FindOneOptions<T extends T ? T : T>): Promise<DiscordCollection<T[K], C>>;

    /**
     * Gets multiple documents from the collection and then
     * index them based on the given key.
     * 
     * @param key The key to index.
     * @param filter The document filter.
     * @param options The options for retrieving the documents. 
     * @returns The indexed documents in a discord.js collection.
     */
    async get<K extends keyof T>(key: K, filter: FilterQuery<T> = { }, options?: WithoutProjection<FindOneOptions<T>> | FindOneOptions<T extends T ? T : T>): Promise<DiscordCollection<T[K], C>> {
        //@ts-expect-error: Overload is a bit wonky, but this should work
        const res: T[] = await this.collection.find(filter, options).toArray();

        const collection: DiscordCollection<T[K], C> = new DiscordCollection();

        for (const data of res) {
            collection.set(data[key], new this.utilityInstance(data));
        }

        return collection;
    }

    /**
     * Gets a document from the collection and convert it
     * to its utility.
     * 
     * @param filter The document filter.
     * @returns The converted document.
     */
    async getOne(filter?: FilterQuery<T>): Promise<C | null>;

    /**
     * Gets a document from the collection and convert it
     * to its utility.
     * 
     * @param filter The document filter.
     * @param options The options for retrieving the documents.
     * @returns The converted document.
     */
    async getOne(filter: FilterQuery<T>, options: FindOneOptions<T extends T ? T : T>): Promise<C | null>;

    /**
     * Gets a document from the collection and convert it
     * to its utility.
     * 
     * @param filter The document filter.
     * @param options The options for retrieving the documents.
     * @returns The converted document.
     */
    async getOne(filter: FilterQuery<T>, options?: WithoutProjection<FindOneOptions<T>>): Promise<C | null>;

    /**
     * Gets a document from the collection and convert it
     * to its utility.
     * 
     * @param filter The document filter.
     * @param options The options for retrieving the documents.
     * @returns The converted document.
     */
    async getOne(filter: FilterQuery<T> = { }, options?: WithoutProjection<FindOneOptions<T>> | FindOneOptions<T extends T ? T : T>): Promise<C | null> {
        const res: T | null = await this.collection.findOne(filter, options);

        return res ? new this.utilityInstance(res) : null;
    }

    /**
     * Delete multiple documents from the collection.
     * 
     * @param filter The filter used to select the documents to remove.
     * @returns An object containing information about the operation.
     */
    delete(filter: FilterQuery<T>): Promise<OperationResult> {
        return new Promise(resolve => {
            this.collection.deleteMany(filter, err => {
                if (err) {
                    return resolve(this.createOperationResult(false, err.message));
                }

                resolve(this.createOperationResult(true));
            });
        });
    }

    /**
     * Inserts multiple documents into the collection.
     * 
     * @param docs The part of documents to insert. Each document will be assigned to the default document with `Object.assign()`.
     */
    insert(...docs: Partial<T>[]): Promise<OperationResult> {
        return new Promise(resolve => {
            this.collection.insertMany(docs.map(v => <OptionalId<T>> Object.assign(this.defaultDocument, v)), err => {
                if (err) {
                    return resolve(this.createOperationResult(false, err.message));
                }

                resolve(this.createOperationResult(true));
            });
        });
    }
}