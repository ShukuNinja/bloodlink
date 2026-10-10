import type {
  HospitalSearchRequest,
  HospitalSummary,
} from '@bloodlink/contracts';
import { useCallback, useState } from 'react';
import { ApiClientError } from '../../../api/client';
import { hospitalDiscoveryApi } from './api';

export interface HospitalSearchState {
  results: HospitalSummary[] | null;
  loading: boolean;
  error: ApiClientError | null;
  searched: boolean;
}

/**
 * OWNER: D2
 * PURPOSE: Mobile discovery data hook. Local state is used because the
 * mobile foundation has not established a shared data-fetching library yet;
 * transport is the real API client.
 */
export function useHospitalSearch() {
  const [state, setState] = useState<HospitalSearchState>({
    results: null,
    loading: false,
    error: null,
    searched: false,
  });

  const search = useCallback(async (input: HospitalSearchRequest) => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await hospitalDiscoveryApi.search(input);
      setState({
        results: response.data,
        loading: false,
        error: null,
        searched: true,
      });
      return response.data;
    } catch (error) {
      setState({
        results: null,
        loading: false,
        error:
          error instanceof ApiClientError
            ? error
            : new ApiClientError(0, 'MALFORMED', 'Unexpected error'),
        searched: true,
      });
      return null;
    }
  }, []);

  return { ...state, search };
}
