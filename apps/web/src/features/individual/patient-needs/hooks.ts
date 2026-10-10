import type {
  CreatePatientNeedRequest,
  PatientNeedListResponse,
  PatientNeedRecord,
} from '@bloodlink/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/api/client';
import { patientNeedApi } from './api';

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError
    ? error
    : new ApiClientError(0, 'MALFORMED', 'Unexpected error');
}

/**
 * OWNER: D2
 * PURPOSE: PatientNeed journey hooks for the individual web screens.
 * Local-state hooks are used because the web foundation has not established
 * a shared data-fetching library yet; transport is the real API client.
 */
export function usePatientNeedHistory(page: number, pageSize: number) {
  const [state, setState] = useState<{
    data: PatientNeedListResponse | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await patientNeedApi.list({ page, pageSize });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: toClientError(error) });
    }
  }, [page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function usePatientNeed(id: string | undefined) {
  const [state, setState] = useState<{
    record: PatientNeedRecord | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ record: null, loading: Boolean(id), error: null });

  const reload = useCallback(async () => {
    if (!id) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await patientNeedApi.get(id);
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

export function useCreatePatientNeed() {
  const [state, setState] = useState<{
    submitting: boolean;
    created: PatientNeedRecord | null;
    error: ApiClientError | null;
  }>({ submitting: false, created: null, error: null });

  const create = useCallback(async (input: CreatePatientNeedRequest) => {
    setState({ submitting: true, created: null, error: null });
    try {
      const response = await patientNeedApi.create(input);
      setState({ submitting: false, created: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        submitting: false,
        created: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  return { ...state, create };
}

export function useCancelPatientNeed() {
  const [state, setState] = useState<{
    cancelling: boolean;
    cancelled: PatientNeedRecord | null;
    error: ApiClientError | null;
  }>({ cancelling: false, cancelled: null, error: null });

  const cancel = useCallback(async (id: string) => {
    setState({ cancelling: true, cancelled: null, error: null });
    try {
      const response = await patientNeedApi.cancel(id);
      setState({ cancelling: false, cancelled: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        cancelling: false,
        cancelled: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  return { ...state, cancel };
}
