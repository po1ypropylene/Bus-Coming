import { BusFront, MapPin, Sparkles } from 'lucide-react'

export function JourneyArt() {
    return (
        <div className="journey-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-road" />
            <span className="art-pin">
                <MapPin size={25} />
            </span>
            <span className="art-bus">
                <BusFront size={42} strokeWidth={1.5} />
            </span>
            <span className="art-star">
                <Sparkles size={19} />
            </span>
            <i className="art-dot" />
        </div>
    )
}
