import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

export const useLazyTabRender = () => {
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasBeenFocused(true);
    }
  }, [isFocused]);

  return {
    isFocused,
    shouldRender: isFocused || hasBeenFocused,
  };
};
