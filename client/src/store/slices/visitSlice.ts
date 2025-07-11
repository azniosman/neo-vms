import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface VisitState {
  visits: any[];
  loading: boolean;
  error: string | null;
}

const initialState: VisitState = {
  visits: [],
  loading: false,
  error: null,
};

const visitSlice = createSlice({
  name: 'visits',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setVisits: (state, action: PayloadAction<any[]>) => {
      state.visits = action.payload;
    },
    addVisit: (state, action: PayloadAction<any>) => {
      state.visits.push(action.payload);
    },
    updateVisit: (state, action: PayloadAction<any>) => {
      const index = state.visits.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.visits[index] = action.payload;
      }
    },
    removeVisit: (state, action: PayloadAction<string>) => {
      state.visits = state.visits.filter(v => v.id !== action.payload);
    },
  },
});

export const { setLoading, setError, setVisits, addVisit, updateVisit, removeVisit } = visitSlice.actions;
export default visitSlice.reducer;