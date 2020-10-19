import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  DocumentNode,
  HttpLink,
  split,
  ApolloLink,
  Observable,
} from '@apollo/client/core';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';
import { BigNumber } from 'ethers';
import { isBigNumber, Service } from '../common';
import { ApiOptions, ApiRequestOptions, ApiRequestQueryOptions } from './interfaces';
import { buildApiUri, catchApiError, mapApiResult } from './utils';

export class ApiService extends Service {
  private readonly options: ApiOptions;

  private apolloClient: ApolloClient<NormalizedCacheObject>;

  constructor(options: ApiOptions) {
    super();

    this.options = {
      port: null,
      useSsl: false,
      ...options,
    };
  }

  async query<T extends {}>(query: DocumentNode, options?: ApiRequestQueryOptions<T>): Promise<T> {
    let result: T = null;

    options = {
      variables: {},
      fetchPolicy: 'no-cache',
      ...options,
    };

    const {
      omitChainIdVariable, //
      variables,
      fetchPolicy,
      models,
    } = options;

    try {
      const { data } = await this.apolloClient.query<T>({
        query,
        fetchPolicy,
        variables: this.prepareApiVariables(variables, omitChainIdVariable),
      });

      result = mapApiResult(data, models);
    } catch (err) {
      catchApiError(err);
    }

    return result;
  }

  async mutate<T extends {}>(mutation: DocumentNode, options?: ApiRequestOptions<T>): Promise<T> {
    let result: T = null;

    options = {
      variables: {},
      ...options,
    };

    const {
      omitChainIdVariable, //
      variables,
      models,
    } = options;

    try {
      const { data } = await this.apolloClient.mutate<T>({
        mutation,
        variables: this.prepareApiVariables(variables, omitChainIdVariable),
      });

      result = mapApiResult(data, models);
    } catch (err) {
      catchApiError(err);
    }

    return result;
  }

  subscribe<T extends {}>(query: DocumentNode, options?: ApiRequestOptions<T>): Observable<T> {
    const {
      omitChainIdVariable, //
      variables,
      models,
    } = options;

    return this.apolloClient
      .subscribe<T>({
        query,
        variables: this.prepareApiVariables(variables, omitChainIdVariable),
      })

      .map(({ data }) => mapApiResult(data, models));
  }

  protected onInit(): void {
    const httpLink = new HttpLink({
      fetch,
      uri: buildApiUri(this.options, 'http'),
    });

    const wsLink = new WebSocketLink({
      webSocketImpl: WebSocket,
      uri: buildApiUri(this.options, 'ws', 'graphql'),
      options: {
        reconnect: true,
        lazy: true,
      },
    });

    const authLink = new ApolloLink((operation, forward) => {
      const { authService } = this.services;

      operation.setContext({
        headers: authService.headers,
      });

      return forward(operation);
    });

    const link = split(
      // split based on operation type
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      authLink.concat(httpLink),
    );

    this.apolloClient = new ApolloClient({
      link,
      cache: new InMemoryCache({
        resultCaching: false,
      }),
    });
  }

  private prepareApiVariables(
    variables: { [keys: string]: any },
    omitChainIdVariable: boolean,
  ): { [key: string]: any } {
    const result: { [key: string]: any } = {};

    const keys = Object.keys(variables || {});

    for (const key of keys) {
      let value: any;
      if (isBigNumber(variables[key])) {
        value = BigNumber.from(variables[key]).toHexString();
      } else {
        value = variables[key];
      }
      result[key] = value;
    }

    if (!omitChainIdVariable) {
      const { chainId } = this.services.networkService;

      result.chainId = chainId;
    }

    return result;
  }
}