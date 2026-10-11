import type {
  AssignResponderRequest,
  ResponderAssignmentResponse,
  ResponderResponseListResponse,
} from '@bloodlink/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/api/client';
import { responderCoordinationApi } from './api';

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError
    ? error
    : new ApiClientError(0, 'MALFORMED', 'Unexpected error');
}

export function useHospitalResponderResponses(
  bloodRequestId: string | undefined,
) {
  const [state, setState] = useState<{
    responses: ResponderResponseListResponse | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ responses: null, loading: Boolean(bloodRequestId), error: null });

  const reload = useCallback(async () => {
    if (!bloodRequestId) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response =
        await responderCoordinationApi.listResponses(bloodRequestId);
      setState({ responses: response, loading: false, error: null });
    } catch (error) {
      setState({
        responses: null,
        loading: false,
        error: toClientError(error),
      });
    }
  }, [bloodRequestId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useRespondToHospitalRequest() {
  const [state, setState] = useState<{
    submitting: boolean;
    result: ResponderAssignmentResponse['data'] | null;
    error: ApiClientError | null;
  }>({ submitting: false, result: null, error: null });

  const perform = useCallback(
    async (
      bloodRequestId: string,
      responseId: string,
      action: 'select' | 'standby' | 'release',
      input: AssignResponderRequest,
    ) => {
      setState({ submitting: true, result: null, error: null });
      try {
        const response =
          action === 'select'
            ? await responderCoordinationApi.select(
                bloodRequestId,
                responseId,
                input,
              )
            : action === 'standby'
              ? await responderCoordinationApi.standby(
                  bloodRequestId,
                  responseId,
                  input,
                )
              : await responderCoordinationApi.release(
                  bloodRequestId,
                  responseId,
                  input,
                );
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
    },
    [],
  );

  return { ...state, perform };
}
