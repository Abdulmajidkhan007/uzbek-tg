import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Share,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import type { ChatStackParamList } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'MediaPreview'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Zoomable image sub-component
// ---------------------------------------------------------------------------
interface ZoomableImageProps {
  uri: string;
  onDoubleTap: () => void;
}

const ZoomableImage = React.memo(function ZoomableImage({
  uri,
  onDoubleTap,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, translateX, translateY, savedScale, savedX, savedY]);

  const handleDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (scale.value > 1) {
      resetZoom();
    } else {
      scale.value = withSpring(2.5, { damping: 20, stiffness: 200 });
      savedScale.value = 2.5;
      onDoubleTap();
    }
  }, [scale, savedScale, resetZoom, onDoubleTap]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      scale.value = newScale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTap)();
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture),
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <Image
          source={{ uri }}
          style={styles.fullImage}
          resizeMode="contain"
          accessibilityRole="image"
        />
      </Animated.View>
    </GestureDetector>
  );
});

// ---------------------------------------------------------------------------
// Pagination dot sub-component
// ---------------------------------------------------------------------------
interface PaginationDotsProps {
  count: number;
  activeIndex: number;
}

const PaginationDots = React.memo(function PaginationDots({
  count,
  activeIndex,
}: PaginationDotsProps) {
  const theme = useTheme();
  if (count <= 1) return null;

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i === activeIndex ? theme.colors.primary : 'rgba(255,255,255,0.4)',
              width: i === activeIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
            },
          ]}
        />
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function MediaPreviewScreen({ route, navigation }: Props): React.JSX.Element {
  const { mediaUrls, initialIndex, title } = route.params;

  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const headerOpacity = useSharedValue(1);

  const toggleHeader = useCallback(() => {
    const nextVisible = !isHeaderVisible;
    setIsHeaderVisible(nextVisible);
    headerOpacity.value = withTiming(nextVisible ? 1 : 0, { duration: 200 });
  }, [isHeaderVisible, headerOpacity]);

  const animatedHeader = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = mediaUrls[currentIndex];
    if (!url) return;
    try {
      await Share.share({ message: url, title });
    } catch {
      // Share dismissed
    }
  }, [mediaUrls, currentIndex, title]);

  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Download', 'File download started.');
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < mediaUrls.length) {
        setCurrentIndex(index);
        Haptics.selectionAsync();
      }
    },
    [currentIndex, mediaUrls.length],
  );

  const counterText = useMemo(
    () => `${currentIndex + 1} / ${mediaUrls.length}`,
    [currentIndex, mediaUrls.length],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <View style={[styles.root, { backgroundColor: '#000000' }]}>
        {/* Swipeable image pager */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
          keyboardShouldPersistTaps="handled"
          decelerationRate="fast"
          style={styles.pager}
        >
          {mediaUrls.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              style={styles.pageWrapper}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={toggleHeader}
                style={StyleSheet.absoluteFill}
                accessibilityRole="button"
                accessibilityLabel="Toggle controls"
              >
                <View style={styles.imagePage}>
                  <ZoomableImage uri={uri} onDoubleTap={toggleHeader} />
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Header overlay */}
        <Animated.View
          style={[styles.header, animatedHeader]}
          pointerEvents={isHeaderVisible ? 'auto' : 'none'}
        >
          <SafeAreaView edges={['top']} style={styles.headerInner}>
            <View
              style={[
                styles.headerRow,
                {
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
            >
              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.7}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel="Close media preview"
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text
                  style={[
                    theme.textStyles.chatName,
                    { color: '#FFFFFF', textAlign: 'center' },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {mediaUrls.length > 1 && (
                  <Text
                    style={[
                      theme.textStyles.caption,
                      { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
                    ]}
                  >
                    {counterText}
                  </Text>
                )}
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={handleDownload}
                  activeOpacity={0.7}
                  style={[styles.headerBtn, { marginRight: theme.spacing.xs }]}
                  accessibilityRole="button"
                  accessibilityLabel="Download media"
                >
                  <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.7}
                  style={styles.headerBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Share media"
                >
                  <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>

        {/* Bottom pagination overlay */}
        <Animated.View
          style={[styles.bottomOverlay, animatedHeader]}
          pointerEvents="none"
        >
          <SafeAreaView edges={['bottom']}>
            <PaginationDots count={mediaUrls.length} activeIndex={currentIndex} />
          </SafeAreaView>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imagePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  headerInner: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.40)',
    zIndex: 10,
    paddingTop: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
    flexWrap: 'wrap',
  },
  dot: {
    borderRadius: 3,
  },
});
