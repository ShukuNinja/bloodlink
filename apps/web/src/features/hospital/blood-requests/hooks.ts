import type {
  BloodRequestDetail,
  BloodRequestRecord,
  BloodRequestListQuery,
  BloodRequestListResponse,
} from '@bloodlink/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/api/client';
import { bloodRequestApi } from './api';

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError
    ? error
    : new ApiClientError(0, 'MALFORMED', 'Unexpected error');
}

export function useHospitalBloodRequests(query?: BloodRequestListQuery) {
  const [state, setState] = useState<{
    data: BloodRequestListResponse | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await bloodRequestApi.list({
        page: query?.page,
        pageSize: query?.pageSize,
        status: query?.status,
      });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: toClientError(error) });
    }
  }, [query?.page, query?.pageSize, query?.status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useHospitalBloodRequest(id: string | undefined) {
  const [state, setState] = useState<{
    record: BloodRequestDetail | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ record: null, loading: Boolean(id), error: null });

  const reload = useCallback(async () => {
    if (!id) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await bloodRequestApi.get(id);
      setState({ record: response.data, loading: false, error: null });
    } catch (error) {
      setState({ record: null, loading: false, error: toClientError(error) });
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useCancelHospitalBloodRequest() {
  const [state, setState] = useState<{
    cancelling: boolean;
    result: BloodRequestRecord | null;
    error: ApiClientError | null;
  }>({ cancelling: false, result: null, error: null });

  const cancel = useCallback(async (id: string) => {
    setState({ cancelling: true, result: null, error: null });
    try {
      const response = await bloodRequestApi.cancel(id);
      setState({ cancelling: false, result: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        cancelling: false,
        result: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  return { ...state, cancel };
}

export function useFulfillmentHospitalBloodRequest() {
  const [state, setState] = useState<{
    submitting: boolean;
    result: BloodRequestRecord | null;
    error: ApiClientError | null;
  }>({ submitting: false, result: null, error: null });

  const startFulfillment = useCallback(async (id: string) => {
    setState({ submitting: true, result: null, error: null });
    try {
      const response = await bloodRequestApi.startFulfillment(id);
      setState({ submitting: false, result: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        submitting: false,
        result: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  const confirmFulfillment = useCallback(async (id: string) => {
    setState({ submitting: true, result: null, error: null });
    try {
      const response = await bloodRequestApi.confirmFulfillment(id);
      setState({ submitting: false, result: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        submitting: false,
        result: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  return { ...state, startFulfillment, confirmFulfillment };
}
