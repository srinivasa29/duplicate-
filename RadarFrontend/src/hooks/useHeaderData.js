import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchNotifications, markNotificationsRead, markSingleNotificationRead } from '../api/notificationApi';
import { fetchUserProfile } from '../api/userApi';

const getStoredUser = () => {
    try {
        const rawUser = localStorage.getItem('user');
        return rawUser ? JSON.parse(rawUser) : null;
    } catch {
        return null;
    }
};

const buildFallbackProfile = () => {
    const storedUser = getStoredUser();
    const email = localStorage.getItem('email') || storedUser?.email || '';
    const username = localStorage.getItem('username') || storedUser?.name || storedUser?.username || (email ? email.split('@')[0] : 'Radar User');

    return {
        username: username,
        email: email || 'account@radar.com',
        preferredMode: localStorage.getItem('mode') || storedUser?.preferredMode || 'INVESTOR',
        watchlist: []
    };
};

const buildFallbackNotifications = () => {
    const now = Date.now();

    return [
        {
            _id: 'fallback-1',
            id: 'fallback-1',
            title: 'Price Alert Triggered',
            message: 'RELIANCE crossed your alert level at Rs 2,985.',
            createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
            read: false
        },
        {
            _id: 'fallback-2',
            id: 'fallback-2',
            title: 'Watchlist Update',
            message: 'NIFTY 50 moved +0.52% in the last session.',
            createdAt: new Date(now - 22 * 60 * 1000).toISOString(),
            read: false
        },
        {
            _id: 'fallback-3',
            id: 'fallback-3',
            title: 'Market Brief Ready',
            message: 'Your morning market summary is available.',
            createdAt: new Date(now - 65 * 60 * 1000).toISOString(),
            read: true
        }
    ];
};

export const useHeaderData = () => {
    const [profile, setProfile] = useState(buildFallbackProfile);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [isMarkingNotifications, setIsMarkingNotifications] = useState(false);
    const [userImage, setUserImage] = useState(() => localStorage.getItem('profileImage'));

    const loadProfile = useCallback(async () => {
        const fallbackProfile = buildFallbackProfile();

        try {
            const response = await fetchUserProfile();
            const mergedProfile = {
                ...fallbackProfile,
                ...response
            };
            if (response?.username) localStorage.setItem('username', response.username);
            if (response?.email) localStorage.setItem('email', response.email);

            setProfile(mergedProfile);
            return mergedProfile;
        } catch (error) {
            console.error('Failed to load user profile:', error);
            setProfile(fallbackProfile);
            return fallbackProfile;
        }
    }, []);

    const loadNotifications = useCallback(async () => {
        const token = localStorage.getItem('token');
        const fallbackNotifications = buildFallbackNotifications();

        if (!token) {
            setNotifications(fallbackNotifications);
            return fallbackNotifications;
        }

        try {
            setIsLoadingNotifications(true);
            const response = await fetchNotifications();
            const resolvedNotifications = Array.isArray(response)
                ? response
                : [];

            setNotifications(resolvedNotifications);
            return resolvedNotifications;
        } catch (error) {
            console.error('Failed to load notifications:', error);
            setNotifications(fallbackNotifications);
            return fallbackNotifications;
        } finally {
            setIsLoadingNotifications(false);
        }
    }, []);

    const markSingleRead = useCallback(async (id) => {
        const token = localStorage.getItem('token');

        setNotifications((currentNotifications) =>
            currentNotifications.map((notification) => {
                const notificationId = notification._id || notification.id;
                return notificationId === id ? { ...notification, read: true } : notification;
            })
        );

        if (!token) {
            return;
        }

        try {
            await markSingleNotificationRead(id);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }, []);

    const markAllNotificationsRead = useCallback(async () => {
        const token = localStorage.getItem('token');

        if (notifications.every((notification) => notification.read)) {
            return;
        }

        try {
            setIsMarkingNotifications(true);

            if (token) {
                await markNotificationsRead();
            }

            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) => ({
                    ...notification,
                    read: true
                }))
            );
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        } finally {
            setIsMarkingNotifications(false);
        }
    }, [notifications]);

    useEffect(() => {
        loadProfile();
        loadNotifications();

        const handleUpdate = () => {
            loadProfile();
            setUserImage(localStorage.getItem('profileImage'));
        };
        window.addEventListener('profile_updated', handleUpdate);

        const pollInterval = setInterval(() => {
            loadNotifications();
        }, 45000);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('profile_updated', handleUpdate);
        };
    }, [loadProfile, loadNotifications]);

    const userInitial = useMemo(() => {
        const source = profile?.username || profile?.email || 'User';
        return source.charAt(0).toUpperCase();
    }, [profile]);

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications]
    );

    return {
        profile,
        userInitial,
        userImage,
        notifications,
        unreadCount,
        isLoadingNotifications,
        isMarkingNotifications,
        reloadProfile: loadProfile,
        reloadNotifications: loadNotifications,
        markAllNotificationsRead,
        markSingleRead
    };
};
