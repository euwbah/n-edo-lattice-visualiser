/**
 * 
 * Create a rotation matrix such that vector 1 will be aligned to vector 2 after rotation.
 * 
 * @param {p5.Vector} v1
 * @param {p5.Vector} v2 
 * @returns {number[]} 4x4 rotation matrix
 */
function rotateAlign(v1, v2) {
    const axis = v1.cross(v2);

    const cosA = v1.dot(v2);
    const k = 1.0 / (1.0 + cosA);

    return [
        (axis.x * axis.x * k) + cosA,   // 1,1
        (axis.y * axis.x * k) - axis.z, // 1,2
        (axis.z * axis.x * k) + axis.y, // 1,3
        0,                              // 1,4
        (axis.x * axis.y * k) + axis.z, // 2,1
        (axis.y * axis.y * k) + cosA,   // 2,2
        (axis.z * axis.y * k) - axis.x, // 2,3
        0,                              // 2,4
        (axis.x * axis.z * k) - axis.y, // 3,1
        (axis.y * axis.z * k) + axis.x, // 3,2
        (axis.z * axis.z * k) + cosA,   // 3,3
        0,                              // 3,4
        0,                              // 4,1
        0,                              // 4,2
        0,                              // 4,3
        1                               // 4,4
    ];
    
    // return [
    //     (axis.x * axis.x * k) + cosA,   // 1,1
    //     (axis.x * axis.y * k) + axis.z, // 2,1
    //     (axis.x * axis.z * k) - axis.y, // 3,1
    //     0,                              // 4,1
    //     (axis.y * axis.x * k) - axis.z, // 1,2
    //     (axis.y * axis.y * k) + cosA,   // 2,2
    //     (axis.y * axis.z * k) + axis.x, // 3,2
    //     0,                              // 4,2
    //     (axis.z * axis.x * k) + axis.y, // 1,3
    //     (axis.z * axis.y * k) - axis.x, // 2,3
    //     (axis.z * axis.z * k) + cosA,   // 3,3
    //     0,                              // 4,3
    //     0,                              // 1,4
    //     0,                              // 2,4
    //     0,                              // 3,4
    //     1                               // 4,4
    // ];
}