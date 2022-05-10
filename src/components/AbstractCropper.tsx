import React, { useImperativeHandle, useRef, CSSProperties, Ref, useState } from 'react';
import cn from 'classnames';
import { DrawOptions } from 'advanced-cropper/canvas';
import { StretchAlgorithm } from 'advanced-cropper/html';
import { DefaultSettings, defaultStencilConstraints } from 'advanced-cropper/defaults';
import {
	BoundarySizeAlgorithm,
	CropperImage,
	CropperState,
	CropperTransitions,
	ModifiersSettings,
} from 'advanced-cropper/types';
import {
	CropperBackgroundWrapperComponent,
	CropperWrapperComponent,
	StencilComponent,
	CropperBackgroundComponent,
	ArbitraryProps,
	StencilConstraints,
	StencilOptions,
} from '../types';
import { useWindowResize } from '../hooks/useWindowResize';
import { useCropperImage } from '../hooks/useCropperImage';
import {
	CropperStateHook,
	CropperStateSettings,
	CropperStateSettingsProp,
	useCropperState,
} from '../hooks/useCropperState';
import { mergeRefs } from '../service/react';
import { useUpdateEffect } from '../hooks/useUpdateEffect';
import { useStateWithCallback } from '../hooks/useStateWithCallback';
import { AbstractCropperStateCallbacks, AbstractCropperStateParameters } from '../hooks/useAbstractCropperState';
import { createCropper } from '../service/cropper';
import { useStencil } from '../hooks/useStencil';
import { StretchableBoundary, StretchableBoundaryMethods } from './service/StretchableBoundary';
import { CropperWrapper } from './service/CropperWrapper';
import { CropperBackgroundImage } from './service/CropperBackgroundImage';
import { CropperCanvas, CropperCanvasMethods } from './service/CropperCanvas';
import { RectangleStencil } from './stencils/RectangleStencil';
import { CropperBackgroundWrapper } from './service/CropperBackgroundWrapper';
import './AbstractCropper.scss';

export type AbstractCropperSettingsProp<Settings extends CropperStateSettings> = CropperStateSettingsProp<Settings>;

export type AbstractCropperSettings = DefaultSettings & ModifiersSettings;

export interface AbstractCropperRef<Settings extends AbstractCropperSettings = AbstractCropperSettings> {
	reset: () => void;
	refresh: () => void;
	setCoordinates: CropperStateHook['setCoordinates'];
	setState: CropperStateHook['setState'];
	setImage: (image: CropperImage) => void;
	setStencilOptions: (options: StencilOptions) => void;
	getStencilOptions: () => StencilOptions;
	flipImage: CropperStateHook['flipImage'];
	zoomImage: CropperStateHook['zoomImage'];
	rotateImage: CropperStateHook['rotateImage'];
	reconcileState: CropperStateHook['reconcileState'];
	moveImage: CropperStateHook['moveImage'];
	moveCoordinates: CropperStateHook['moveCoordinates'];
	moveCoordinatesEnd: CropperStateHook['moveCoordinatesEnd'];
	resizeCoordinates: CropperStateHook['resizeCoordinates'];
	resizeCoordinatesEnd: CropperStateHook['resizeCoordinatesEnd'];
	transformImage: CropperStateHook['transformImage'];
	transformImageEnd: CropperStateHook['transformImageEnd'];
	getCoordinates: CropperStateHook['getCoordinates'];
	getVisibleArea: CropperStateHook['getVisibleArea'];
	getTransforms: CropperStateHook['getTransforms'];
	getStencilCoordinates: CropperStateHook['getStencilCoordinates'];
	getCanvas: (options?: DrawOptions) => HTMLCanvasElement | null;
	getSettings: () => Settings;
	getImage: () => CropperImage | null;
	getState: () => CropperState | null;
	getTransitions: () => CropperTransitions;
}

export interface AbstractCropperProps<Settings extends AbstractCropperSettings>
	extends AbstractCropperStateParameters<Settings>,
		AbstractCropperStateCallbacks<AbstractCropperRef<Settings>> {
	src?: string | null;
	backgroundComponent?: CropperBackgroundComponent;
	backgroundProps?: ArbitraryProps;
	backgroundWrapperComponent?: CropperBackgroundWrapperComponent;
	backgroundWrapperProps?: ArbitraryProps;
	wrapperComponent?: CropperWrapperComponent;
	wrapperProps?: ArbitraryProps;
	stencilComponent?: StencilComponent;
	stencilProps?: ArbitraryProps;
	stencilConstraints?: StencilConstraints<AbstractCropperSettingsProp<Settings>>;
	className?: string;
	imageClassName?: string;
	boundaryClassName?: string;
	backgroundClassName?: string;
	checkOrientation?: boolean;
	canvas?: boolean;
	crossOrigin?: 'anonymous' | 'use-credentials';
	boundarySizeAlgorithm?: BoundarySizeAlgorithm | string;
	stretchAlgorithm?: StretchAlgorithm;
	style?: CSSProperties;
	onReady?: (cropper: AbstractCropperRef<Settings>) => void;
	onError?: (cropper: AbstractCropperRef<Settings>) => void;
	unloadTime?: number;
	settings: AbstractCropperSettingsProp<Settings>;
}

export type AbstractCropperIntrinsicProps<Settings extends AbstractCropperSettings> = Omit<
	AbstractCropperProps<Settings>,
	'settings'
>;

const AbstractCropperComponent = <Settings extends AbstractCropperSettings = AbstractCropperSettings>(
	props: AbstractCropperProps<Settings>,
	ref: Ref<AbstractCropperRef<Settings>>,
) => {
	const {
		src,
		stencilComponent = RectangleStencil,
		stencilConstraints = defaultStencilConstraints,
		stencilProps = {},
		wrapperComponent = CropperWrapper,
		wrapperProps = {},
		backgroundComponent = CropperBackgroundImage,
		backgroundProps = {},
		backgroundWrapperComponent = CropperBackgroundWrapper,
		backgroundWrapperProps = {},
		imageClassName,
		className,
		boundaryClassName,
		backgroundClassName,
		boundarySizeAlgorithm,
		stretchAlgorithm,
		crossOrigin = true,
		checkOrientation = true,
		canvas = true,
		style,
		onReady,
		onError,
		unloadTime = 500,
		settings,
		...parameters
	} = props;

	const imageRef = useRef<HTMLImageElement | HTMLCanvasElement>(null);
	const boundaryRef = useRef<StretchableBoundaryMethods>(null);
	const canvasRef = useRef<CropperCanvasMethods>(null);
	const cropperRef = useRef<AbstractCropperRef<Settings>>(null);

	const stencil = useStencil(stencilComponent);

	const cropper = useCropperState({
		...parameters,
		getInstance() {
			return cropperRef.current;
		},
		settings: {
			...settings,
			...stencilConstraints(settings, stencil.options),
		},
	});

	const { image, loaded, loading } = useCropperImage({
		src,
		crossOrigin,
		checkOrientation,
		unloadTime,
		canvas,
		onLoad() {
			if (cropperRef.current) {
				onReady?.(cropperRef.current);
			}
		},
		onError() {
			if (cropperRef.current) {
				onError?.(cropperRef.current);
			}
		},
	});

	const [currentImage, setCurrentImage] = useStateWithCallback<CropperImage | null>(null);

	const resetCropper = () => {
		boundaryRef.current?.stretchTo(image).then((boundary) => {
			setCurrentImage(image, () => {
				if (boundary && image) {
					cropper.reset(boundary, image);
				} else {
					cropper.clear();
				}
			});
		});
	};

	const refreshCropper = () => {
		boundaryRef.current?.stretchTo(image).then((boundary) => {
			if (boundary && image) {
				if (cropper.state) {
					cropper.setBoundary(boundary);
				} else {
					cropper.reset(boundary, image);
				}
			} else {
				cropper.clear();
			}
		});
	};

	const cropperInterface = {
		reset: () => {
			resetCropper();
		},
		refresh: () => {
			refreshCropper();
		},
		getCanvas: (options?: DrawOptions) => {
			if (imageRef.current && canvasRef.current && cropper.state) {
				return canvasRef.current.draw(cropper.state, imageRef.current, options);
			} else {
				return null;
			}
		},
		getImage: () => {
			return currentImage ? { ...currentImage } : null;
		},
		setImage: (image: CropperImage) => {
			setCurrentImage(image);
		},
		getStencilOptions: () => {
			return stencil.options;
		},
		setStencilOptions: (options: StencilOptions) => {
			stencil.setOptions(options);
		},
		reconcileState: cropper.reconcileState,
		moveCoordinates: cropper.moveCoordinates,
		moveCoordinatesEnd: cropper.moveCoordinatesEnd,
		resizeCoordinates: cropper.resizeCoordinates,
		resizeCoordinatesEnd: cropper.resizeCoordinatesEnd,
		moveImage: cropper.moveImage,
		flipImage: cropper.flipImage,
		zoomImage: cropper.zoomImage,
		rotateImage: cropper.rotateImage,
		transformImage: cropper.transformImage,
		transformImageEnd: cropper.transformImageEnd,
		setCoordinates: cropper.setCoordinates,
		setState: cropper.setState,
		getStencilCoordinates: cropper.getStencilCoordinates,
		getCoordinates: cropper.getCoordinates,
		getVisibleArea: cropper.getVisibleArea,
		getTransforms: cropper.getTransforms,
		getTransitions: cropper.getTransitions,
		getSettings: cropper.getSettings,
		getState: cropper.getState,
	};

	useWindowResize(() => {
		refreshCropper();
	});

	useUpdateEffect(() => {
		cropper.reconcileState();
	}, [stencil.options]);

	useUpdateEffect(() => {
		resetCropper();
	}, [image]);

	useImperativeHandle(mergeRefs([ref, cropperRef]), () => cropperInterface);

	const StencilComponent = stencil.component;

	const WrapperComponent = wrapperComponent;

	const BackgroundWrapperComponent = backgroundWrapperComponent;

	const BackgroundComponent = backgroundComponent;

	return (
		<WrapperComponent
			{...wrapperProps}
			className={cn('react-advanced-cropper', className)}
			loaded={loaded}
			cropper={cropperInterface}
			loading={loading}
			style={style}
		>
			<StretchableBoundary
				ref={boundaryRef}
				stretchAlgorithm={stretchAlgorithm}
				sizeAlgorithm={boundarySizeAlgorithm}
				className={cn('react-advanced-cropper__boundary', boundaryClassName)}
				stretcherClassName={cn('react-advanced-cropper__stretcher')}
			>
				<BackgroundWrapperComponent
					{...backgroundWrapperProps}
					cropper={cropperInterface}
					className={'react-advanced-cropper__background-wrapper'}
				>
					<div className={cn('react-advanced-cropper__background', backgroundClassName)}>
						{cropper.state && (
							<BackgroundComponent
								{...backgroundProps}
								ref={imageRef}
								crossOrigin={crossOrigin}
								cropper={cropperInterface}
								className={cn('react-advanced-cropper__image', imageClassName)}
							/>
						)}
					</div>
					<StencilComponent {...stencilProps} cropper={cropperInterface} image={currentImage} />
				</BackgroundWrapperComponent>
				{canvas && <CropperCanvas ref={canvasRef} />}
			</StretchableBoundary>
		</WrapperComponent>
	);
};

export const AbstractCropper = createCropper(AbstractCropperComponent);