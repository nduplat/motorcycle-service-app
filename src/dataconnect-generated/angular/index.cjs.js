const { createNewListRef, getMyListsRef, addMovieToListRef, getMoviesInListRef } = require('../');
const { DataConnect, CallerSdkTypeEnum } = require('@angular/fire/data-connect');
const { injectDataConnectQuery, injectDataConnectMutation } = require('@tanstack-query-firebase/angular/data-connect');
const { inject, EnvironmentInjector } = require('@angular/core');

exports.injectCreateNewList = function injectCreateNewList(args, injector) {
  return injectDataConnectMutation(createNewListRef, args, injector, CallerSdkTypeEnum.GeneratedAngular);
}

exports.injectGetMyLists = function injectGetMyLists(options, injector) {
  const finalInjector = injector || inject(EnvironmentInjector);
  const dc = finalInjector.get(DataConnect);
  return injectDataConnectQuery(() => {
    const addOpn = options && options();
    return {
      queryFn: () =>  getMyListsRef(dc),
      ...addOpn
    };
  }, finalInjector, CallerSdkTypeEnum.GeneratedAngular);
}

exports.injectAddMovieToList = function injectAddMovieToList(args, injector) {
  return injectDataConnectMutation(addMovieToListRef, args, injector, CallerSdkTypeEnum.GeneratedAngular);
}

exports.injectGetMoviesInList = function injectGetMoviesInList(args, options, injector) {
  const finalInjector = injector || inject(EnvironmentInjector);
  const dc = finalInjector.get(DataConnect);
  const varsFactoryFn = (typeof args === 'function') ? args : () => args;
  return injectDataConnectQuery(() => {
    const addOpn = options && options();
    return {
      queryFn: () =>  getMoviesInListRef(dc, varsFactoryFn()),
      ...addOpn
    };
  }, finalInjector, CallerSdkTypeEnum.GeneratedAngular);
}

