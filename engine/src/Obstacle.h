#pragma once
#include <string>

namespace ptp {

    // ceated obstacles that matches game theme at leaast i tried, lol)
    enum class ObstacleType {
        BUG, MERGE_CONFLICT, SCOPE_CREEP, SLACK_NOTIFICATION
    };

    // the invisible collision box mathematicay wrapped around game entities
    struct AABB {
        float x, y, w, h;

        // checks if this box's coordinates overlap with an outside box ('o')
        bool intersects(const AABB& o) const {
            return x < o.x + o.w && x + w > o.x && 
                   y < o.y + o.h && y + h > o.y;
        }
    };

    // reps moving hazard on the grid
    struct Obstacle {
        std::string  id;
        ObstacleType type;
        AABB         bounds;     // The active hit-box for collision detection
        float        velocityX;  // The speed at which it sweeps across the screen
        int          lane;       // Grid row identifier for spawned obstacles

        Obstacle(std::string id, ObstacleType type, int lane,
                float startX, float y, float w, float h, float vx)
            : id(std::move(id)), type(type)
            , bounds{startX, y, w, h}, velocityX(vx), lane(lane)
        {}
    };
}