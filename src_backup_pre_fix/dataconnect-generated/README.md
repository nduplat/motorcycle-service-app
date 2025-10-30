# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `Angular README`, you can find it at [`dataconnect-generated/angular/README.md`](./angular/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyLists*](#getmylists)
  - [*GetMoviesInList*](#getmoviesinlist)
- [**Mutations**](#mutations)
  - [*CreateNewList*](#createnewlist)
  - [*AddMovieToList*](#addmovietolist)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyLists
You can execute the `GetMyLists` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyLists(): QueryPromise<GetMyListsData, undefined>;

interface GetMyListsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyListsData, undefined>;
}
export const getMyListsRef: GetMyListsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyLists(dc: DataConnect): QueryPromise<GetMyListsData, undefined>;

interface GetMyListsRef {
  ...
  (dc: DataConnect): QueryRef<GetMyListsData, undefined>;
}
export const getMyListsRef: GetMyListsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyListsRef:
```typescript
const name = getMyListsRef.operationName;
console.log(name);
```

### Variables
The `GetMyLists` query has no variables.
### Return Type
Recall that executing the `GetMyLists` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyListsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyListsData {
  lists: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    public: boolean;
  } & List_Key)[];
}
```
### Using `GetMyLists`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyLists } from '@dataconnect/generated';


// Call the `getMyLists()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyLists();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyLists(dataConnect);

console.log(data.lists);

// Or, you can use the `Promise` API.
getMyLists().then((response) => {
  const data = response.data;
  console.log(data.lists);
});
```

### Using `GetMyLists`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyListsRef } from '@dataconnect/generated';


// Call the `getMyListsRef()` function to get a reference to the query.
const ref = getMyListsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyListsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.lists);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.lists);
});
```

## GetMoviesInList
You can execute the `GetMoviesInList` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMoviesInList(vars: GetMoviesInListVariables): QueryPromise<GetMoviesInListData, GetMoviesInListVariables>;

interface GetMoviesInListRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMoviesInListVariables): QueryRef<GetMoviesInListData, GetMoviesInListVariables>;
}
export const getMoviesInListRef: GetMoviesInListRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMoviesInList(dc: DataConnect, vars: GetMoviesInListVariables): QueryPromise<GetMoviesInListData, GetMoviesInListVariables>;

interface GetMoviesInListRef {
  ...
  (dc: DataConnect, vars: GetMoviesInListVariables): QueryRef<GetMoviesInListData, GetMoviesInListVariables>;
}
export const getMoviesInListRef: GetMoviesInListRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMoviesInListRef:
```typescript
const name = getMoviesInListRef.operationName;
console.log(name);
```

### Variables
The `GetMoviesInList` query requires an argument of type `GetMoviesInListVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMoviesInListVariables {
  listId: UUIDString;
}
```
### Return Type
Recall that executing the `GetMoviesInList` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMoviesInListData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMoviesInListData {
  list?: {
    movies_via_ListMovie: ({
      id: UUIDString;
      title: string;
      year: number;
    } & Movie_Key)[];
  };
}
```
### Using `GetMoviesInList`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMoviesInList, GetMoviesInListVariables } from '@dataconnect/generated';

// The `GetMoviesInList` query requires an argument of type `GetMoviesInListVariables`:
const getMoviesInListVars: GetMoviesInListVariables = {
  listId: ..., 
};

// Call the `getMoviesInList()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMoviesInList(getMoviesInListVars);
// Variables can be defined inline as well.
const { data } = await getMoviesInList({ listId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMoviesInList(dataConnect, getMoviesInListVars);

console.log(data.list);

// Or, you can use the `Promise` API.
getMoviesInList(getMoviesInListVars).then((response) => {
  const data = response.data;
  console.log(data.list);
});
```

### Using `GetMoviesInList`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMoviesInListRef, GetMoviesInListVariables } from '@dataconnect/generated';

// The `GetMoviesInList` query requires an argument of type `GetMoviesInListVariables`:
const getMoviesInListVars: GetMoviesInListVariables = {
  listId: ..., 
};

// Call the `getMoviesInListRef()` function to get a reference to the query.
const ref = getMoviesInListRef(getMoviesInListVars);
// Variables can be defined inline as well.
const ref = getMoviesInListRef({ listId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMoviesInListRef(dataConnect, getMoviesInListVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.list);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.list);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateNewList
You can execute the `CreateNewList` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNewList(): MutationPromise<CreateNewListData, undefined>;

interface CreateNewListRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateNewListData, undefined>;
}
export const createNewListRef: CreateNewListRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNewList(dc: DataConnect): MutationPromise<CreateNewListData, undefined>;

interface CreateNewListRef {
  ...
  (dc: DataConnect): MutationRef<CreateNewListData, undefined>;
}
export const createNewListRef: CreateNewListRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNewListRef:
```typescript
const name = createNewListRef.operationName;
console.log(name);
```

### Variables
The `CreateNewList` mutation has no variables.
### Return Type
Recall that executing the `CreateNewList` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNewListData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNewListData {
  list_insert: List_Key;
}
```
### Using `CreateNewList`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNewList } from '@dataconnect/generated';


// Call the `createNewList()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNewList();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNewList(dataConnect);

console.log(data.list_insert);

// Or, you can use the `Promise` API.
createNewList().then((response) => {
  const data = response.data;
  console.log(data.list_insert);
});
```

### Using `CreateNewList`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNewListRef } from '@dataconnect/generated';


// Call the `createNewListRef()` function to get a reference to the mutation.
const ref = createNewListRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNewListRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.list_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.list_insert);
});
```

## AddMovieToList
You can execute the `AddMovieToList` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addMovieToList(vars: AddMovieToListVariables): MutationPromise<AddMovieToListData, AddMovieToListVariables>;

interface AddMovieToListRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddMovieToListVariables): MutationRef<AddMovieToListData, AddMovieToListVariables>;
}
export const addMovieToListRef: AddMovieToListRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addMovieToList(dc: DataConnect, vars: AddMovieToListVariables): MutationPromise<AddMovieToListData, AddMovieToListVariables>;

interface AddMovieToListRef {
  ...
  (dc: DataConnect, vars: AddMovieToListVariables): MutationRef<AddMovieToListData, AddMovieToListVariables>;
}
export const addMovieToListRef: AddMovieToListRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addMovieToListRef:
```typescript
const name = addMovieToListRef.operationName;
console.log(name);
```

### Variables
The `AddMovieToList` mutation requires an argument of type `AddMovieToListVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddMovieToListVariables {
  listId: UUIDString;
  movieId: UUIDString;
  position: number;
}
```
### Return Type
Recall that executing the `AddMovieToList` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddMovieToListData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddMovieToListData {
  listMovie_insert: ListMovie_Key;
}
```
### Using `AddMovieToList`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addMovieToList, AddMovieToListVariables } from '@dataconnect/generated';

// The `AddMovieToList` mutation requires an argument of type `AddMovieToListVariables`:
const addMovieToListVars: AddMovieToListVariables = {
  listId: ..., 
  movieId: ..., 
  position: ..., 
};

// Call the `addMovieToList()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addMovieToList(addMovieToListVars);
// Variables can be defined inline as well.
const { data } = await addMovieToList({ listId: ..., movieId: ..., position: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addMovieToList(dataConnect, addMovieToListVars);

console.log(data.listMovie_insert);

// Or, you can use the `Promise` API.
addMovieToList(addMovieToListVars).then((response) => {
  const data = response.data;
  console.log(data.listMovie_insert);
});
```

### Using `AddMovieToList`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addMovieToListRef, AddMovieToListVariables } from '@dataconnect/generated';

// The `AddMovieToList` mutation requires an argument of type `AddMovieToListVariables`:
const addMovieToListVars: AddMovieToListVariables = {
  listId: ..., 
  movieId: ..., 
  position: ..., 
};

// Call the `addMovieToListRef()` function to get a reference to the mutation.
const ref = addMovieToListRef(addMovieToListVars);
// Variables can be defined inline as well.
const ref = addMovieToListRef({ listId: ..., movieId: ..., position: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addMovieToListRef(dataConnect, addMovieToListVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.listMovie_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.listMovie_insert);
});
```

