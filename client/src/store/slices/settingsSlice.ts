import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  settings: any;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    theme: 'light',
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    language: 'en',
    timezone: 'UTC',
    autoLogout: 30,
  },
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSettings: (state, action: PayloadAction<any>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    updateSetting: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      state.settings[key] = value;
    },
    resetSettings: (state) => {
      state.settings = initialState.settings;
    },
  },
});

export const { setLoading, setError, setSettings, updateSetting, resetSettings } = settingsSlice.actions;
export default settingsSlice.reducer;