<template>
  <div class="profile-container">
    <div class="profile-page">
      <section class="profile-hero">
        <div class="hero-identity">
          <div class="avatar-wrapper">
            <userAvatar :user="user" />
          </div>
          <div class="identity-copy">
            <h1>{{ displayName }}</h1>
            <div class="identity-tag-list">
              <div class="identity-tag-row">
                <span class="identity-tag dept-tag" v-if="user.dept">
                  <svg-icon icon-class="tree" />
                  {{ user.dept.deptName || '-' }}
                </span>
                <span class="identity-tag job-tag">
                  <svg-icon icon-class="job" class="job-icon" />
                  <span class="tag-value">{{ postGroup || '-' }}</span>
                </span>
              </div>

              <div class="identity-tag-row">
                <span class="identity-tag detail-tag system-tag">
                  <span class="tag-label">创建时间</span>
                  <span class="tag-value">{{ parseTime(user.createTime) || '-' }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-grid">
          <div class="settings-column">
            <div class="column-heading">
              <h3>基本资料</h3>
            </div>
            <userInfo :user="user" />
          </div>

          <div class="settings-column password-column">
            <div class="column-heading">
              <h3>修改密码</h3>
            </div>
            <resetPwd :user="user" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import userAvatar from "./userAvatar";
import userInfo from "./userInfo";
import resetPwd from "./resetPwd";
import { getUserProfile } from "@/api/system/user";

export default {
  name: "Profile",
  components: {
    userAvatar,
    userInfo,
    resetPwd
  },
  data() {
    return {
      user: {},
      postGroup: ""
    };
  },
  created() {
    this.getUser();
  },
  computed: {
    displayName() {
      return this.user.nickName || this.user.userName || "-";
    }
  },
  methods: {
    getUser() {
      getUserProfile().then(response => {
        this.user = response.data;
        this.postGroup = response.postGroup;
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.profile-container {
  min-height: calc(100vh - 84px);
  padding: 30px 40px 48px;
  background: #ffffff;
}

.profile-page {
  width: min(1160px, 100%);
  margin: 0 auto;
}

.profile-hero {
  padding-bottom: 28px;
  border-bottom: 1px solid #e5e7eb;
}

.hero-identity {
  display: flex;
  align-items: center;
  gap: 28px;
}

.avatar-wrapper {
  width: 108px;
  height: 108px;
  flex: 0 0 auto;
  border-radius: 50%;

  :deep(.user-info-head) {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }
}

.identity-copy {
  min-width: 0;

  h1 {
    margin: 0;
    color: #1f2937;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }
}

.identity-tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  max-width: 820px;
}

.identity-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.identity-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 3px 11px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;

  .svg-icon {
    flex: 0 0 auto;
  }
}

.job-icon {
  color: #2563eb;
  font-size: 15px;
}

.dept-tag {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.detail-tag {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.job-tag {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;

  .tag-value {
    color: #1e3a8a;
  }
}

.system-tag {
  min-height: 28px;
  padding: 2px 10px;
  background: #ffffff;
  border-color: #edf2f7;
  font-size: 13px;
}

.tag-label {
  color: #64748b;
  font-weight: 500;
}

.tag-value {
  color: #334155;
  font-weight: 600;
}

.system-tag .tag-label,
.system-tag .tag-value {
  color: #64748b;
  font-weight: 500;
}

.settings-section {
  padding-top: 28px;
}

.settings-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: stretch;
  gap: 56px;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: #e5e7eb;
    transform: translateX(-50%);
  }
}

.settings-column {
  display: flex;
  flex-direction: column;
  min-width: 0;

  :deep(.el-form),
  :deep(.password-form-shell) {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: min(100%, 520px);
    max-width: 100%;
  }

  :deep(.password-form) {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  :deep(.form-actions-item) {
    margin-top: auto;
    padding-top: 8px;
  }

  :deep(.form-actions-item .el-form-item__content) {
    margin-left: 96px !important;
  }
}

.password-column {
  position: relative;

  :deep(.password-form-shell) {
    margin-left: auto;
  }
}

.column-heading {
  margin-bottom: 16px;

  h3 {
    margin: 0;
    color: #1f2937;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
  }
}

@media (max-width: 1100px) {
  .settings-grid {
    gap: 40px;
  }
}

@media (max-width: 900px) {
  .profile-container {
    padding: 24px 18px 36px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-grid::before {
    display: none;
  }

  .settings-column :deep(.form-actions-item) {
    margin-top: 8px;
    padding-top: 0;
  }
}

@media (max-width: 640px) {
  .hero-identity {
    align-items: flex-start;
  }

  .avatar-wrapper {
    width: 80px;
    height: 80px;
  }

  .identity-copy h1 {
    font-size: 26px;
  }
}
</style>
