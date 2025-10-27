import { CreateNewListData, GetMyListsData, AddMovieToListData, AddMovieToListVariables, GetMoviesInListData, GetMoviesInListVariables } from '../';
import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise} from '@angular/fire/data-connect';
import { CreateQueryResult, CreateMutationResult} from '@tanstack/angular-query-experimental';
import { CreateDataConnectQueryResult, CreateDataConnectQueryOptions, CreateDataConnectMutationResult, DataConnectMutationOptionsUndefinedMutationFn } from '@tanstack-query-firebase/angular/data-connect';
import { FirebaseError } from 'firebase/app';
import { Injector } from '@angular/core';

type CreateNewListOptions = DataConnectMutationOptionsUndefinedMutationFn<CreateNewListData, FirebaseError, undefined>;
export function injectCreateNewList(options?: CreateNewListOptions, injector?: Injector): CreateDataConnectMutationResult<CreateNewListData, undefined, >;

export type GetMyListsOptions = () => Omit<CreateDataConnectQueryOptions<GetMyListsData, undefined>, 'queryFn'>;
export function injectGetMyLists(options?: GetMyListsOptions, injector?: Injector): CreateDataConnectQueryResult<GetMyListsData, undefined>;

type AddMovieToListOptions = DataConnectMutationOptionsUndefinedMutationFn<AddMovieToListData, FirebaseError, AddMovieToListVariables>;
export function injectAddMovieToList(options?: AddMovieToListOptions, injector?: Injector): CreateDataConnectMutationResult<AddMovieToListData, AddMovieToListVariables, AddMovieToListVariables>;

type GetMoviesInListArgs = GetMoviesInListVariables | (() => GetMoviesInListVariables);
export type GetMoviesInListOptions = () => Omit<CreateDataConnectQueryOptions<GetMoviesInListData, GetMoviesInListVariables>, 'queryFn'>;
export function injectGetMoviesInList(args: GetMoviesInListArgs, options?: GetMoviesInListOptions, injector?: Injector): CreateDataConnectQueryResult<GetMoviesInListData, GetMoviesInListVariables>;
