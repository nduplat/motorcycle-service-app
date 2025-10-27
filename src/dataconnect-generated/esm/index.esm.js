import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'blue-dragon-motors-ai-assistant1',
  location: 'us-central1'
};

export const createNewListRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewList');
}
createNewListRef.operationName = 'CreateNewList';

export function createNewList(dc) {
  return executeMutation(createNewListRef(dc));
}

export const getMyListsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyLists');
}
getMyListsRef.operationName = 'GetMyLists';

export function getMyLists(dc) {
  return executeQuery(getMyListsRef(dc));
}

export const addMovieToListRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddMovieToList', inputVars);
}
addMovieToListRef.operationName = 'AddMovieToList';

export function addMovieToList(dcOrVars, vars) {
  return executeMutation(addMovieToListRef(dcOrVars, vars));
}

export const getMoviesInListRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMoviesInList', inputVars);
}
getMoviesInListRef.operationName = 'GetMoviesInList';

export function getMoviesInList(dcOrVars, vars) {
  return executeQuery(getMoviesInListRef(dcOrVars, vars));
}

