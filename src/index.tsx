import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { ImageFormat, useCanvasRef } from '@shopify/react-native-skia';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import styles from './styles';
import DrawnCanvas from './drawn-canvas';
import type {
  DrawingPath,
  DrawnPath,
  FreeCanvasProps,
  FreeCanvasRef,
} from './types';
import DrawingCanvas from './drawing-canvas';
import CanvasContext from './canvas-context';

const FreeCanvas = forwardRef<FreeCanvasRef, FreeCanvasProps>(
  (
    {
      style,
      background,
      foreground,
      pathEffect,
      backgroundColor,
      strokeColor = 'black',
      strokeWidth = 10,
      zoomable,
      onDrawEnd,
    },
    ref,
  ) => {
    const [drawnPaths, setDrawnPaths] = useState<DrawnPath[]>([]);
    const [, setDrawingPath] = useState<DrawingPath | null>(null);
    const drawRef = useCanvasRef();
    const drawnRef = useCanvasRef();
    const originSharedVal = useSharedValue([0, 0]);
    const scaleSharedVal = useSharedValue(1);
    const translateSharedVal = useSharedValue({ x: 0, y: 0 });
    const scaledStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scaleSharedVal.value },
        { translateX: translateSharedVal.value.x },
        { translateY: translateSharedVal.value.y },
      ],
      transformOrigin: originSharedVal.value.concat([0]),
    }));
    const providerVal = useMemo(
      () => ({
        addDrawnPath: (path: DrawnPath) => {
          setDrawnPaths(paths => paths.concat([path]));
        },
        setDrawingPath: (path: DrawingPath | null) => {
          setDrawingPath(path);
        },
        drawnPaths,
        setScale: (x: number, y: number, scale: number) => {
          'worklet';

          const resScale = scale * scaleSharedVal.value;
          if (resScale < 0.5 || resScale > 2) {
            return;
          }
          scaleSharedVal.value = resScale;
          originSharedVal.value = withTiming([x < 0 ? -x : x, y < 0 ? -y : y], {
            duration: 200,
          });
        },
        setTranslate: (x: number, y: number) => {
          'worklet';
          console.log('setTranslate', x, y, translateSharedVal.value);
          translateSharedVal.value = {
            x: translateSharedVal.value.x + x,
            y: translateSharedVal.value.y + y,
          };
        },
      }),
      [drawnPaths],
    );

    const undo = useCallback(
      (step: number = 1) => {
        if (step > drawnPaths.length) {
          return false;
        }
        setDrawnPaths(paths => paths.slice(0, -1 * step));
        return step;
      },
      [drawnPaths],
    );

    const reset = useCallback(() => {
      setDrawnPaths([]);
    }, []);

    const getSnapshot = useCallback(() => {
      return drawnRef.current?.makeImageSnapshotAsync();
    }, []);

    const drawPaths = useCallback((paths: DrawnPath[]) => {
      setDrawnPaths(paths);
    }, []);

    const toPaths = useCallback(() => {
      return drawnPaths;
    }, [drawnPaths]);

    const toBase64 = useCallback(
      async (fmt: ImageFormat = ImageFormat.PNG, quality: number = 80) => {
        const snapshot = await getSnapshot();
        if (!snapshot) {
          return;
        }
        return snapshot.encodeToBase64(fmt, quality);
      },
      [getSnapshot],
    );

    useImperativeHandle(
      ref,
      () => ({
        undo,
        reset,
        getSnapshot,
        toBase64,
        drawPaths,
        toPaths,
      }),
      [undo, reset, getSnapshot, toBase64, toPaths],
    );

    return (
      <CanvasContext.Provider value={providerVal}>
        <View style={[style]}>
          <Animated.View style={[styles.flex1, scaledStyle]}>
            <GestureHandlerRootView style={styles.flex1}>
              {/* Drawn canvas */}
              <DrawnCanvas
                ref={drawnRef}
                background={background}
                foreground={foreground}
                backgroundColor={backgroundColor}
                pathEffect={pathEffect}
              />

              {/* Drawing canvas */}
              <DrawingCanvas
                ref={drawRef}
                foreground={foreground}
                onDrawEnd={onDrawEnd}
                zoomable={zoomable}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                pathEffect={pathEffect}
              />
            </GestureHandlerRootView>
          </Animated.View>
        </View>
      </CanvasContext.Provider>
    );
  },
);

export default memo(FreeCanvas);

export type { FreeCanvasProps, DrawnPath, FreeCanvasRef };
