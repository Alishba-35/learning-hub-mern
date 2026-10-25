import { createContext, useContext } from 'react';

export const LessonContext = createContext(null);
export const useLesson = () => useContext(LessonContext);
