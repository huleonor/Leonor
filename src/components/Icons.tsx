/**
 * The app's icons: Phosphor, one family, bold weight everywhere (fill for the few solid marks:
 * play, stop, star, flame, bolt). Never draw icon paths by hand; add a Phosphor glyph here instead.
 */
import {
  ArrowCounterClockwise, ArrowLeft, ArrowRight, ArrowsDownUp, Barbell, Bell, Bluetooth, CaretDown, CaretLeft, CaretUp, ChartBar,
  Check, Checks, DotsThree, DownloadSimple, Equalizer, Fire, Gauge, Gear, GraduationCap, HandPalm, Headphones, House, Lightning,
  Lock, MagicWand, Microphone, MusicNote, MusicNotesSimple, Notepad, Pause, PencilSimple, PianoKeys, Play, Plus, Repeat, Rewind,
  SignOut, Snowflake, SpeakerHigh, Star, Stop, Trash, X, type Icon as PhIcon, type IconProps,
} from '@phosphor-icons/react';

type P = Omit<IconProps, 'weight'> & { size?: number };

const make = (Glyph: PhIcon, weight: IconProps['weight'] = 'bold') =>
  ({ size = 18, ...rest }: P) => <Glyph size={size} weight={weight} aria-hidden="true" {...rest} />;

export const IconBack = make(CaretLeft);
export const IconPlay = make(Play, 'fill');
export const IconPause = make(Pause, 'fill');
export const IconRestart = make(ArrowCounterClockwise);
export const IconBack5 = make(Rewind, 'fill');
export const IconGear = make(Gear);
export const IconMic = make(Microphone);
export const IconBluetooth = make(Bluetooth);
export const IconKeys = make(PianoKeys);
export const IconImport = make(DownloadSimple);
export const IconTrash = make(Trash);
export const IconClose = make(X);
export const IconFalling = make(Equalizer);
export const IconSheet = make(MusicNotesSimple);
export const IconHeadphones = make(Headphones);
export const IconLock = make(Lock, 'fill');
export const IconStar = make(Star, 'fill');
export const IconHome = make(House);
export const IconMusic = make(MusicNote);
export const IconChart = make(ChartBar);
export const IconFlame = make(Fire, 'fill');
export const IconPlus = make(Plus);
export const IconCheck = make(Check);
export const IconMore = make(DotsThree);
export const IconEdit = make(PencilSimple);
export const IconHand = make(HandPalm);
export const IconSpeed = make(Gauge);
export const IconSpeaker = make(SpeakerHigh);
export const IconDumbbell = make(Barbell);
export const IconCap = make(GraduationCap);
export const IconNotes = make(Notepad);
export const IconFeedback = make(Checks);
export const IconMagic = make(MagicWand);
export const IconAutoScroll = make(ArrowsDownUp);
export const IconExit = make(SignOut);
export const IconChevronUp = make(CaretUp);
export const IconChevronDown = make(CaretDown);
export const IconArrowLeft = make(ArrowLeft);
export const IconArrowRight = make(ArrowRight);
export const IconStop = make(Stop, 'fill');
export const IconLoop = make(Repeat);
export const IconBolt = make(Lightning, 'fill');
export const IconSnow = make(Snowflake);
export const IconBell = make(Bell);
