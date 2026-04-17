import { useMemo, useEffect } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl } from 'react-map-gl/maplibre';
import type { ControlPosition } from 'react-map-gl/maplibre';
import { mapLibreDrawStyle } from './mapLibreDrawStyle';

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;
  onCreate?: (evt: any) => void;
  onUpdate?: (evt: any) => void;
  onDelete?: (evt: any) => void;
  onModeChange?: (evt: any) => void;
  getDrawInstance?: (instance: MapboxDraw) => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function MapDrawControl(props: DrawControlProps) {
  const draw = useMemo(() => new MapboxDraw({
    displayControlsDefault: props.displayControlsDefault !== undefined ? props.displayControlsDefault : false,
    controls: props.controls || { polygon: true, trash: true },
    defaultMode: props.defaultMode || 'simple_select',
    styles: mapLibreDrawStyle,
    touchBuffer: 2,
    clickBuffer: 2
  }), []);

  useEffect(() => {
    if (props.getDrawInstance) {
      props.getDrawInstance(draw);
    }
  }, [draw, props.getDrawInstance]);

  useControl<any>(
    () => draw,
    ({ map }: any) => {
      if (props.onCreate) map.on('draw.create', props.onCreate);
      if (props.onUpdate) map.on('draw.update', props.onUpdate);
      if (props.onDelete) map.on('draw.delete', props.onDelete);
      if (props.onModeChange) map.on('draw.modechange', props.onModeChange);
    },
    ({ map }: any) => {
      if (props.onCreate) map.off('draw.create', props.onCreate);
      if (props.onUpdate) map.off('draw.update', props.onUpdate);
      if (props.onDelete) map.off('draw.delete', props.onDelete);
      if (props.onModeChange) map.off('draw.modechange', props.onModeChange);
    },
    {
      position: props.position
    }
  );

  return null;
}
