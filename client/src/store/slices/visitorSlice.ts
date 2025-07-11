import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface VisitorState {
  visitors: any[];
  loading: boolean;
  error: string | null;
}

const initialState: VisitorState = {
  visitors: [],
  loading: false,
  error: null,
};

const visitorSlice = createSlice({
  name: 'visitors',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setVisitors: (state, action: PayloadAction<any[]>) => {
      state.visitors = action.payload;
    },
    addVisitor: (state, action: PayloadAction<any>) => {
      state.visitors.push(action.payload);
    },
    updateVisitor: (state, action: PayloadAction<any>) => {
      const index = state.visitors.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.visitors[index] = action.payload;
      }
    },
    removeVisitor: (state, action: PayloadAction<string>) => {
      state.visitors = state.visitors.filter(v => v.id !== action.payload);
    },
  },
});

export const { setLoading, setError, setVisitors, addVisitor, updateVisitor, removeVisitor } = visitorSlice.actions;
export default visitorSlice.reducer;