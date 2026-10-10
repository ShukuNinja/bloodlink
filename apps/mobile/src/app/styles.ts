import { StyleSheet } from 'react-native';

export const colors = {
  ink: '#16181d',
  muted: '#5c6470',
  line: '#d8dce3',
  surface: '#f6f7f9',
  card: '#ffffff',
  accent: '#b3261e',
  accentStrong: '#8f1d17',
  ok: '#1c6b3c',
  warn: '#9a6700',
};

export const appStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.card,
    color: colors.ink,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  dangerButton: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '600',
  },
  dangerButtonText: {
    color: colors.accent,
    fontWeight: '700',
  },
  errorBox: {
    borderColor: colors.accent,
    backgroundColor: '#fdf1f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: colors.accentStrong,
  },
  successBox: {
    borderColor: colors.ok,
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  successText: {
    color: colors.ok,
  },
  muted: {
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  linkText: {
    color: colors.accent,
    marginTop: 10,
    fontWeight: '600',
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: colors.card,
  },
  optionChipSelected: {
    borderColor: colors.accent,
    backgroundColor: '#fdf1f0',
  },
  optionChipText: {
    color: colors.ink,
  },
});
